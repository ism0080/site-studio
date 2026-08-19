import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import type { GlobalRole } from "../access/access.ts";
import { nowIso } from "../platform/Time.ts";
import { Member, MemberInput, MemberNotFound } from "./members.ts";
import { SiteId } from "../site/site.ts";

type Db = Cloudflare.D1.QueryDatabaseClient;

export interface MemberRepositoryService {
  /** Invites a client by email, or adds them directly when they already have an account. */
  readonly invite: (
    siteId: string,
    input: MemberInput,
  ) => Effect.Effect<Member, never, RuntimeContext>;
  readonly list: (siteId: string) => Effect.Effect<ReadonlyArray<Member>, never, RuntimeContext>;
  readonly update: (
    siteId: string,
    email: string,
    input: MemberInput,
  ) => Effect.Effect<Member, MemberNotFound, RuntimeContext>;
  readonly remove: (
    siteId: string,
    email: string,
  ) => Effect.Effect<void, MemberNotFound, RuntimeContext>;
  /** Consumes pending invites (site + agency role) once the invited email signs in. */
  readonly materialize: (
    userId: string,
    email: string,
  ) => Effect.Effect<void, never, RuntimeContext>;
  /** The user's global role: env admins first, then user_roles, else client. */
  readonly globalRole: (
    userId: string,
    email: string,
    adminEmails: readonly string[],
  ) => Effect.Effect<GlobalRole, never, RuntimeContext>;
}

const _bool = (n: number) => n === 1;

export const makeMemberRepository = (db: Db): MemberRepositoryService => {
  const _memberRow = (r: {
    site_id: string;
    email: string;
    can_edit: number;
    can_publish: number;
    can_leads: number;
    created_at: string;
  }): Member => ({
    siteId: SiteId.make(r.site_id),
    email: r.email,
    canEdit: _bool(r.can_edit),
    canPublish: _bool(r.can_publish),
    canLeads: _bool(r.can_leads),
    pending: false,
    createdAt: r.created_at,
  });

  return {
    invite: Effect.fn("MemberRepository.invite")(function* (siteId: string, input: MemberInput) {
      const now = yield* nowIso;
      const user = yield* db
        .prepare(`SELECT id FROM "user" WHERE email = ?`)
        .bind(input.email)
        .first<{ id: string }>();

      if (user === null) {
        yield* db
          .prepare(
            "INSERT INTO site_invites (site_id, email, can_edit, can_publish, can_leads, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(site_id, email) DO UPDATE SET can_edit = excluded.can_edit, can_publish = excluded.can_publish, can_leads = excluded.can_leads",
          )
          .bind(
            siteId,
            input.email,
            input.canEdit ? 1 : 0,
            input.canPublish ? 1 : 0,
            input.canLeads ? 1 : 0,
            now,
          )
          .run();
        return {
          siteId: SiteId.make(siteId),
          email: input.email,
          canEdit: input.canEdit,
          canPublish: input.canPublish,
          canLeads: input.canLeads,
          pending: true,
          createdAt: now,
        };
      }

      yield* db
        .prepare(
          "INSERT INTO site_members (site_id, user_id, email, can_edit, can_publish, can_leads, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(site_id, user_id) DO UPDATE SET email = excluded.email, can_edit = excluded.can_edit, can_publish = excluded.can_publish, can_leads = excluded.can_leads, updated_at = excluded.updated_at",
        )
        .bind(
          siteId,
          user.id,
          input.email,
          input.canEdit ? 1 : 0,
          input.canPublish ? 1 : 0,
          input.canLeads ? 1 : 0,
          now,
          now,
        )
        .run();
      return {
        siteId: SiteId.make(siteId),
        email: input.email,
        canEdit: input.canEdit,
        canPublish: input.canPublish,
        canLeads: input.canLeads,
        pending: false,
        createdAt: now,
      };
    }),
    list: Effect.fn("MemberRepository.list")(function* (siteId: string) {
      const members = yield* db
        .prepare(
          "SELECT site_id, email, can_edit, can_publish, can_leads, created_at FROM site_members WHERE site_id = ? ORDER BY created_at DESC",
        )
        .bind(siteId)
        .all<{
          site_id: string;
          email: string;
          can_edit: number;
          can_publish: number;
          can_leads: number;
          created_at: string;
        }>();
      const invites = yield* db
        .prepare(
          "SELECT site_id, email, can_edit, can_publish, can_leads, created_at FROM site_invites WHERE site_id = ? ORDER BY created_at DESC",
        )
        .bind(siteId)
        .all<{
          site_id: string;
          email: string;
          can_edit: number;
          can_publish: number;
          can_leads: number;
          created_at: string;
        }>();
      return [
        ...members.results.map(_memberRow),
        ...invites.results.map((r) => ({
          siteId: SiteId.make(r.site_id),
          email: r.email,
          canEdit: _bool(r.can_edit),
          canPublish: _bool(r.can_publish),
          canLeads: _bool(r.can_leads),
          pending: true,
          createdAt: r.created_at,
        })),
      ];
    }),
    update: Effect.fn("MemberRepository.update")(function* (
      siteId: string,
      email: string,
      input: MemberInput,
    ) {
      const now = yield* nowIso;
      const member = yield* db
        .prepare("SELECT created_at FROM site_members WHERE site_id = ? AND email = ?")
        .bind(siteId, email)
        .first<{ created_at: string }>();
      if (member !== null) {
        yield* db
          .prepare(
            "UPDATE site_members SET can_edit = ?, can_publish = ?, can_leads = ?, updated_at = ? WHERE site_id = ? AND email = ?",
          )
          .bind(
            input.canEdit ? 1 : 0,
            input.canPublish ? 1 : 0,
            input.canLeads ? 1 : 0,
            now,
            siteId,
            email,
          )
          .run();
        return {
          siteId: SiteId.make(siteId),
          email,
          canEdit: input.canEdit,
          canPublish: input.canPublish,
          canLeads: input.canLeads,
          pending: false,
          createdAt: member.created_at,
        };
      }

      const invite = yield* db
        .prepare("SELECT created_at FROM site_invites WHERE site_id = ? AND email = ?")
        .bind(siteId, email)
        .first<{ created_at: string }>();
      if (invite !== null) {
        yield* db
          .prepare(
            "UPDATE site_invites SET can_edit = ?, can_publish = ?, can_leads = ? WHERE site_id = ? AND email = ?",
          )
          .bind(
            input.canEdit ? 1 : 0,
            input.canPublish ? 1 : 0,
            input.canLeads ? 1 : 0,
            siteId,
            email,
          )
          .run();
        return {
          siteId: SiteId.make(siteId),
          email,
          canEdit: input.canEdit,
          canPublish: input.canPublish,
          canLeads: input.canLeads,
          pending: true,
          createdAt: invite.created_at,
        };
      }

      return yield* new MemberNotFound({});
    }),
    remove: Effect.fn("MemberRepository.remove")(function* (siteId: string, email: string) {
      const member = yield* db
        .prepare("DELETE FROM site_members WHERE site_id = ? AND email = ?")
        .bind(siteId, email)
        .run();
      const invite = yield* db
        .prepare("DELETE FROM site_invites WHERE site_id = ? AND email = ?")
        .bind(siteId, email)
        .run();
      if (member.meta.changes === 0 && invite.meta.changes === 0) {
        return yield* new MemberNotFound({});
      }
    }),
    materialize: Effect.fn("MemberRepository.materialize")(function* (
      userId: string,
      email: string,
    ) {
      yield* db
        .prepare(
          "INSERT OR IGNORE INTO site_members (site_id, user_id, email, can_edit, can_publish, can_leads, created_at, updated_at) SELECT site_id, ?, ?, can_edit, can_publish, can_leads, created_at, created_at FROM site_invites WHERE email = ?",
        )
        .bind(userId, email, email)
        .run();
      yield* db.prepare("DELETE FROM site_invites WHERE email = ?").bind(email).run();

      yield* db
        .prepare(
          "INSERT OR IGNORE INTO user_roles (user_id, role, created_at) SELECT ?, 'agency', created_at FROM role_invites WHERE email = ?",
        )
        .bind(userId, email)
        .run();
      yield* db.prepare("DELETE FROM role_invites WHERE email = ?").bind(email).run();
    }),
    globalRole: Effect.fn("MemberRepository.globalRole")(function* (
      userId: string,
      email: string,
      adminEmails: readonly string[],
    ) {
      if (adminEmails.includes(email)) return "admin";
      const row = yield* db
        .prepare("SELECT role FROM user_roles WHERE user_id = ?")
        .bind(userId)
        .first<{ role: "admin" | "agency" | "client" }>();
      return row === null ? "client" : row.role;
    }),
  };
};

export class MemberRepository extends Context.Service<MemberRepository, MemberRepositoryService>()(
  "@app/MemberRepository",
) {}

export const MemberRepositoryLayer = (db: Db) =>
  Layer.effect(
    MemberRepository,
    Effect.sync(() => makeMemberRepository(db)),
  );
