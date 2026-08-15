import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

export const nowIso = Effect.map(DateTime.now, (dt) => DateTime.toDateUtc(dt).toISOString());
