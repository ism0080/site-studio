import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import { nowIso } from "../platform/Time.ts";
import type { Agency } from "./admin.ts";

type Db = Cloudflare.D1.QueryDatabaseClient;

export interface AdminRepositoryService {
  readonly list: () => Effect.Effect<ReadonlyArray<Agency>, never, RuntimeContext>;
  /** Promotes an existing user, or queues an invite for a yet-to-sign-in email. */
  readonly invite: (email: string) => Effect.Effect<Agency, never, RuntimeContext>;
  readonly remove: (email: string) => Effect.Effect<void, never, RuntimeContext>;
}

export const makeAdminRepository = (db: Db): AdminRepositoryService => ({
  list: Effect.fn("AdminRepository.list")(function* () {
    const agencies = yield* db
      .prepare(
        "SELECT u.email, ur.created_at FROM user_roles ur JOIN \"user\" u ON u.id = ur.user_id WHERE ur.role = 'agency' ORDER BY ur.created_at DESC",
      )
      .bind()
      .all<{ email: string; created_at: string }>();
    const invites = yield* db
      .prepare("SELECT email, created_at FROM role_invites ORDER BY created_at DESC")
      .bind()
      .all<{ email: string; created_at: string }>();
    return [
      ...agencies.results.map((r) => ({ email: r.email, pending: false, createdAt: r.created_at })),
      ...invites.results.map((r) => ({ email: r.email, pending: true, createdAt: r.created_at })),
    ];
  }),
  invite: Effect.fn("AdminRepository.invite")(function* (email: string) {
    const now = yield* nowIso;
    const user = yield* db
      .prepare(`SELECT id FROM "user" WHERE email = ?`)
      .bind(email)
      .first<{ id: string }>();

    if (user === null) {
      yield* db
        .prepare(
          "INSERT INTO role_invites (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING",
        )
        .bind(email, now)
        .run();
      return { email, pending: true, createdAt: now };
    }

    const existing = yield* db
      .prepare("SELECT created_at FROM user_roles WHERE user_id = ?")
      .bind(user.id)
      .first<{ created_at: string }>();
    yield* db
      .prepare(
        "INSERT INTO user_roles (user_id, role, created_at) VALUES (?, 'agency', ?) ON CONFLICT(user_id) DO UPDATE SET role = 'agency'",
      )
      .bind(user.id, existing?.created_at ?? now)
      .run();
    return { email, pending: false, createdAt: existing?.created_at ?? now };
  }),
  remove: Effect.fn("AdminRepository.remove")(function* (email: string) {
    yield* db
      .prepare(
        "DELETE FROM user_roles WHERE role = 'agency' AND user_id IN (SELECT id FROM \"user\" WHERE email = ?)",
      )
      .bind(email)
      .run();
    yield* db.prepare("DELETE FROM role_invites WHERE email = ?").bind(email).run();
  }),
});

export class AdminRepository extends Context.Service<AdminRepository, AdminRepositoryService>()(
  "@app/AdminRepository",
) {}

export const AdminRepositoryLayer = (db: Db) =>
  Layer.effect(
    AdminRepository,
    Effect.sync(() => makeAdminRepository(db)),
  );
