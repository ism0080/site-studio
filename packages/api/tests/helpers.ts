import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Effect from "effect/Effect";
import { RuntimeContext } from "alchemy";

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
    bind: (...params: unknown[]) => {
      const stmt = db.prepare(sql);
      return {
        all: <T>() =>
          Effect.sync(() => ({
            results: stmt.all(...(params as Array<string | number | null>)) as unknown as T[],
          })),
        first: <T>() =>
          Effect.sync(
            () => (stmt.get(...(params as Array<string | number | null>)) ?? null) as T | null,
          ),
        run: () =>
          Effect.sync(
            () =>
              ({
                meta: { changes: stmt.run(...(params as Array<string | number | null>)).changes },
              }) as never,
          ),
      };
    },
  }),
});

/**
 * Runs a repository/storage Effect. The real D1/R2 clients type these effects
 * as requiring alchemy's RuntimeContext; our shims don't need it, so a dummy
 * service is provided to satisfy the type.
 */
export const run = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provideService(RuntimeContext, {} as never)));
