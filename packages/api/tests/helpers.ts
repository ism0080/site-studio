import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Effect from "effect/Effect";
import { RuntimeContext } from "alchemy";
import { WebCrypto } from "../src/platform/WebCrypto.ts";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

/** In-memory SQLite with all migrations applied. */
export const makeDb = (): DatabaseSync => {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .toSorted()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
};

/**
 * Minimal D1 QueryDatabaseClient shim over node:sqlite — enough of the
 * prepare/bind/all/first/run surface the repositories use.
 */
export const memoryD1 = (db: DatabaseSync) => ({
  prepare: (sql: string) => ({
    bind: (...params: Array<string | number | null>) => {
      const stmt = db.prepare(sql);
      // SAFETY: node:sqlite results match the D1 row types the repositories request; the D1 surface is the test boundary.
      return {
        all: <T>() =>
          Effect.sync(() => ({
            results: stmt.all(...params) as T[],
          })),
        first: <T>() => Effect.sync(() => (stmt.get(...params) ?? null) as T | null),
        run: () =>
          Effect.sync(() => ({
            meta: { changes: stmt.run(...params).changes },
          })),
      };
    },
  }),
});

// SAFETY: The shim intentionally implements a narrower surface than the real D1 client; the cast bridges the type for tests.
export const d1 = (db: DatabaseSync) =>
  // SAFETY: The shim intentionally implements a narrower surface than the real D1 client; the cast bridges the type for tests.
  memoryD1(db) as never;

/**
 * Runs a repository/storage Effect. The real D1/R2 clients type these effects
 * as requiring alchemy's RuntimeContext; our shims don't need it, so a dummy
 * service is provided to satisfy the type.
 */
// SAFETY: The D1/R2 shims never read the RuntimeContext service, so a stub value satisfies the type.
export const run = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(
    effect.pipe(
      // SAFETY: The D1/R2 shims never read the RuntimeContext service, so a stub value satisfies the type.
      Effect.provideService(RuntimeContext, {} as never),
      Effect.provide(WebCrypto),
    ),
  );
