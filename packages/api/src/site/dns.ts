/**
 * DNS ownership verification via Cloudflare's public DNS-over-HTTPS resolver.
 * No API key required — the ownership proof is the customer publishing the
 * TXT record, which only the domain owner can do.
 */

import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";

export const TXT_PREFIX = "_site-studio-verify";

export const newVerificationToken = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  return `site-studio-verify=${(yield* crypto.randomUUIDv4.pipe(Effect.orDie)).replaceAll("-", "")}`;
});

export interface DnsJson {
  Answer?: Array<{ data?: string }>;
}

export interface DnsFetch {
  (
    url: string,
    init?: { headers?: Record<string, string> },
  ): Promise<{
    ok: boolean;
    json(): Promise<DnsJson>;
  }>;
}

/**
 * Checks whether `_site-studio-verify.<domain>` currently publishes a TXT
 * record equal to `token`. Returns `false` on any DNS error or non-match.
 */
export const verifyTxtRecord = async (
  domain: string,
  token: string,
  fetchFn: DnsFetch = fetch,
): Promise<boolean> => {
  const name = `${TXT_PREFIX}.${domain}`;
  return fetchFn(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: "application/dns-json" },
  })
    .then((res) => {
      if (!res.ok) return false;
      return res
        .json()
        .then((json) =>
          (json.Answer ?? []).some((answer) => answer.data?.replace(/^"|"$/g, "") === token),
        );
    })
    .catch(() => false);
};
