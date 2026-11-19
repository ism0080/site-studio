import type { EmailMessage } from "./email.ts";

export interface SiteInviteEmailInput {
  readonly to: string;
  readonly siteName: string;
  readonly siteId: string;
  readonly webUrl: string;
  readonly inviterEmail: string;
}

export interface AgencyInviteEmailInput {
  readonly to: string;
  readonly webUrl: string;
  readonly inviterEmail: string;
}

const _escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const _link = (webUrl: string, path: string): string => new URL(path, webUrl).toString();

const _bodyHtml = (paragraph: string, href: string, label: string): string =>
  `<p>${paragraph}</p><p><a href="${_escapeHtml(href)}" style="color:#e56645">${label}</a></p>`;

/** "You've been invited to edit <site>" with a link that activates access on sign-in. */
export const siteInviteEmail = (input: SiteInviteEmailInput): EmailMessage => {
  const siteUrl = _link(input.webUrl, `/sites/${encodeURIComponent(input.siteId)}`);
  const paragraph =
    `${input.inviterEmail} invited you to edit ${input.siteName} on Site Studio. ` +
    `Open the site and sign in as ${input.to} — your access activates automatically.`;

  return {
    to: input.to,
    subject: `You've been invited to edit ${input.siteName} on Site Studio`,
    text: `${paragraph}\n\n${siteUrl}`,
    html: _bodyHtml(_escapeHtml(paragraph), siteUrl, `Open ${_escapeHtml(input.siteName)}`),
  };
};

/** "You've been invited as an agency partner" with a link to the web app. */
export const agencyInviteEmail = (input: AgencyInviteEmailInput): EmailMessage => {
  const appUrl = _link(input.webUrl, "/");
  const paragraph =
    `${input.inviterEmail} invited you to join Site Studio as an agency partner. ` +
    `Sign in as ${input.to} — your access activates automatically.`;

  return {
    to: input.to,
    subject: "You've been invited as an agency partner on Site Studio",
    text: `${paragraph}\n\n${appUrl}`,
    html: _bodyHtml(_escapeHtml(paragraph), appUrl, "Open Site Studio"),
  };
};
