import * as Effect from "effect/Effect";
import { newVerificationToken, verifyTxtRecord } from "../src/site/dns.ts";
import { WebCrypto } from "../src/platform/WebCrypto.ts";

const _makeFetch =
  (answers: Array<{ data?: string }>, opts?: { ok?: boolean; throws?: boolean }) => async () => {
    if (opts?.throws) throw new Error("network down");
    return {
      ok: opts?.ok ?? true,
      json: async () => ({ Answer: answers }),
    };
  };

let failed = 0;
const _check = (label: string, got: boolean, expected: boolean) => {
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} -> ${got}`);
};

const token = "site-studio-verify=abc123";

_check(
  "matching record",
  await verifyTxtRecord("aurora.co", token, _makeFetch([{ data: token }])),
  true,
);
_check(
  "quoted record still matches",
  await verifyTxtRecord("aurora.co", token, _makeFetch([{ data: `"${token}"` }])),
  true,
);
_check(
  "different record",
  await verifyTxtRecord("aurora.co", token, _makeFetch([{ data: "other=xyz" }])),
  false,
);
_check("no answers", await verifyTxtRecord("aurora.co", token, _makeFetch([])), false);
_check(
  "dns error response",
  await verifyTxtRecord("aurora.co", token, _makeFetch([], { ok: false })),
  false,
);
_check(
  "network failure",
  await verifyTxtRecord("aurora.co", token, _makeFetch([], { throws: true })),
  false,
);

const t = Effect.runSync(Effect.provide(newVerificationToken, WebCrypto));
_check("token format", t.startsWith("site-studio-verify="), true);
_check("token has entropy", t.length > "site-studio-verify=".length + 8, true);

if (failed > 0) process.exit(1);
console.log("dns verification tests passed");
