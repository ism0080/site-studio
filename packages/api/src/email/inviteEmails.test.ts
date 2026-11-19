import { describe, expect, it } from "@effect/vitest";
import { agencyInviteEmail, siteInviteEmail } from "./inviteEmails.ts";

describe("inviteEmails", () => {
  it("site invite names the site, inviter, and sign-in email with a deep link", () => {
    const email = siteInviteEmail({
      to: "client@example.com",
      siteName: "Aurora Studio",
      siteId: "site-123",
      webUrl: "https://app.site-studio.dev",
      inviterEmail: "owner@agency.com",
    });

    expect(email.to).toBe("client@example.com");
    expect(email.subject).toBe("You've been invited to edit Aurora Studio on Site Studio");
    expect(email.text).toContain("owner@agency.com");
    expect(email.text).toContain("client@example.com");
    expect(email.text).toContain("https://app.site-studio.dev/sites/site-123");
    expect(email.html).toContain('href="https://app.site-studio.dev/sites/site-123"');
  });

  it("site invite normalizes a trailing slash in the web url", () => {
    const email = siteInviteEmail({
      to: "client@example.com",
      siteName: "Aurora Studio",
      siteId: "site-123",
      webUrl: "https://app.site-studio.dev/",
      inviterEmail: "owner@agency.com",
    });

    expect(email.text).toContain("https://app.site-studio.dev/sites/site-123");
  });

  it("agency invite links to the web app root", () => {
    const email = agencyInviteEmail({
      to: "partner@agency.com",
      webUrl: "https://app.site-studio.dev",
      inviterEmail: "admin@site-studio.dev",
    });

    expect(email.subject).toBe("You've been invited as an agency partner on Site Studio");
    expect(email.text).toContain("admin@site-studio.dev");
    expect(email.text).toContain("partner@agency.com");
    expect(email.text).toContain("https://app.site-studio.dev/");
    expect(email.html).toContain('href="https://app.site-studio.dev/"');
  });

  it("escapes user-provided names in html", () => {
    const email = siteInviteEmail({
      to: "client@example.com",
      siteName: "A <script>alert(1)</script>",
      siteId: "site-123",
      webUrl: "https://app.site-studio.dev",
      inviterEmail: "owner@agency.com",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
