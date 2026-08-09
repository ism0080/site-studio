import { newVerificationToken, verifyTxtRecord } from "../src/site/dns.ts";

const makeFetch =
  (answers: Array<{ data?: string }>, opts?: { ok?: boolean; throws?: boolean }) => async () => {
    if (opts?.throws) throw new Error("network down");
    return {
      ok: opts?.ok ?? true,
      json: async () => ({ Answer: answers }),
    };
  };

let failed = 0;
const check = (label: string, got: boolean, expected: boolean) => {
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} -> ${got}`);
};

const token = "site-studio-verify=abc123";

check(
  "matching record",
  await verifyTxtRecord("aurora.co", token, makeFetch([{ data: token }])),
  true,
);
check(
  "quoted record still matches",
  await verifyTxtRecord("aurora.co", token, makeFetch([{ data: `"${token}"` }])),
  true,
);
check(
  "different record",
  await verifyTxtRecord("aurora.co", token, makeFetch([{ data: "other=xyz" }])),
  false,
);
check("no answers", await verifyTxtRecord("aurora.co", token, makeFetch([])), false);
check(
  "dns error response",
  await verifyTxtRecord("aurora.co", token, makeFetch([], { ok: false })),
  false,
);
check(
  "network failure",
  await verifyTxtRecord("aurora.co", token, makeFetch([], { throws: true })),
  false,
);

const t = newVerificationToken();
check("token format", t.startsWith("site-studio-verify="), true);
check("token has entropy", t.length > "site-studio-verify=".length + 8, true);

if (failed > 0) process.exit(1);
console.log("dns verification tests passed");
