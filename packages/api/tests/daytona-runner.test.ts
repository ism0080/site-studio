import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { DaytonaEnv, makeClient } from "../src/publish/daytona.ts";
import { Site } from "../src/site/site.ts";

const site = Schema.decodeUnknownSync(Site)({
  id: "site_test_build",
  ownerId: "owner-1",
  templateId: "clean-grid",
  status: "published",
  business: {
    name: "Test Studio",
    category: "Test",
    location: "Portland",
    email: "hello@test.studio",
    phone: "",
    logo: "TEST",
  },
  settings: {
    accent: "#4567db",
    font: "Space Grotesk",
    showDirectory: true,
    bg: "#101422",
    ink: "#f5f7ff",
    surface: "#1a2138",
  },
  pages: [
    {
      id: "page_home",
      slug: "/",
      title: "Homepage",
      sections: [
        {
          id: "b1",
          type: "hero",
          props: {
            eyebrow: "Eyebrow",
            headline: "Headline",
            description: "Description",
            primaryCta: "Start",
            secondaryCta: "Learn",
            image: "",
          },
        },
      ],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const env: DaytonaEnv = {
  apiKey: Redacted.make("test-key"),
  apiUrl: "https://api.daytona.test",
  snapshot: Option.some("site-template"),
  image: Option.none(),
  repoDir: "/home/daytona/site-template",
  cpu: 2,
  memory: 2,
  r2Endpoint: "https://r2.test",
  r2Bucket: "sites-bucket",
  r2AccessKeyId: "access",
  r2SecretAccessKey: Redacted.make("r2-secret"),
  publicApiUrl: Option.some("https://api.site-studio.dev"),
};

const _makeFetch = (overrides: Record<string, Response> = {}) => {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ?? null });
    const override = overrides[`${method} ${url}`];
    if (override) return override;
    if (method === "POST" && url.endsWith("/sandbox")) {
      return Response.json({ id: "sandbox_1", toolboxProxyUrl: "https://proxy.test" });
    }
    if (url.endsWith("/files/bulk-upload")) {
      return new Response(null, { status: 200 });
    }
    if (url.endsWith("/process/execute")) {
      return Response.json({ exitCode: 0, stdout: "rendered ok" });
    }
    if (method === "DELETE" && url.endsWith("/sandbox/sandbox_1")) {
      return new Response(null, { status: 200 });
    }
    return new Response("unexpected endpoint", { status: 500 });
  };
  return { calls, fetcher };
};

describe("Daytona build runner", () => {
  it("creates a sandbox, uploads the site document, and runs the build", async () => {
    const { calls, fetcher } = _makeFetch();
    const client = makeClient(env, fetcher);

    const result = await Effect.runPromise(client.publish(site));

    expect(result.buildId).toBe("sandbox_1");
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("rendered ok");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://api.daytona.test/sandbox",
      "POST https://proxy.test/sandbox_1/files/bulk-upload",
      "POST https://proxy.test/sandbox_1/process/execute",
      "DELETE https://api.daytona.test/sandbox/sandbox_1",
    ]);

    const createBody = String(calls[0].body);
    expect(createBody).toContain('"app":"site-studio"');
    expect(createBody).toContain('"site":"site_test_build"');
    expect(createBody).toContain('"autoDeleteInterval":30');
    expect(createBody).toContain('"snapshot":"site-template"');
    expect(createBody).toContain('"R2_BUCKET":"sites-bucket"');

    const executeBody = String(calls[2].body);
    expect(executeBody).toContain('"command":"bun run publish site.json --upload"');
    expect(executeBody).toContain('"cwd":"/home/daytona/site-template"');
    expect(executeBody).toContain('"timeout":600');
  });

  it("falls back to the toolbox proxy url endpoint when the sandbox omits it", async () => {
    const { calls, fetcher } = _makeFetch({
      "POST https://api.daytona.test/sandbox": Response.json({ id: "sandbox_1" }),
      "GET https://api.daytona.test/sandbox/sandbox_1/toolbox-proxy-url": Response.json({
        url: "https://proxy.test",
      }),
    });
    const client = makeClient(env, fetcher);

    const result = await Effect.runPromise(client.publish(site));

    expect(result.buildId).toBe("sandbox_1");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toContain(
      "GET https://api.daytona.test/sandbox/sandbox_1/toolbox-proxy-url",
    );
  });

  it("fails with a BuildError when the sandbox cannot be created", async () => {
    const { fetcher } = _makeFetch({
      "POST https://api.daytona.test/sandbox": new Response("bad request", { status: 400 }),
    });
    const client = makeClient(env, fetcher);

    const failure = await Effect.runPromise(Effect.flip(client.publish(site)));
    expect(failure._tag).toBe("BuildError");
    expect(failure.message).toContain("create sandbox failed");
  });
});
