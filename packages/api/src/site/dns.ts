/**
 * DNS ownership verification via Cloudflare's public DNS-over-HTTPS resolver.
 * No API key required — the ownership proof is the customer publishing the
 * TXT record, which only the domain owner can do.
 */

export const TXT_PREFIX = "_site-studio-verify"

export const newVerificationToken = (): string =>
  `site-studio-verify=${crypto.randomUUID().replaceAll("-", "")}`

export interface DnsFetch {
  (url: string, init?: { headers?: Record<string, string> }): Promise<{
    ok: boolean
    json(): Promise<unknown>
  }>
}

/**
 * Checks whether `_site-studio-verify.<domain>` currently publishes a TXT
 * record equal to `token`. Returns `false` on any DNS error or non-match.
 */
export const verifyTxtRecord = async (
  domain: string,
  token: string,
  fetchFn: DnsFetch = fetch as DnsFetch,
): Promise<boolean> => {
  const name = `${TXT_PREFIX}.${domain}`
  try {
    const res = await fetchFn(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
      { headers: { accept: "application/dns-json" } },
    )
    if (!res.ok) return false
    const json = (await res.json()) as { Answer?: Array<{ data?: string }> }
    return (json.Answer ?? []).some(
      (answer) => answer.data?.replace(/^"|"$/g, "") === token,
    )
  } catch {
    return false
  }
}
