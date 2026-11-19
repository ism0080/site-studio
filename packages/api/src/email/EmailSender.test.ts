import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as Schema from "effect/Schema";
import { run } from "../test/helpers.ts";
import { makeNoopEmailSender, makeResendEmailSender, type EmailMessage } from "./EmailSender.ts";

const _message: EmailMessage = {
  to: "client@example.com",
  subject: "You've been invited",
  text: "Plain text body",
  html: "<p>HTML body</p>",
};

const _fakeFetch = (respond: () => Response | Promise<Response>) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return respond();
  };
  return { calls, fetcher };
};

const _sender = (fetcher: typeof fetch) =>
  makeResendEmailSender({
    apiKey: "re_test_key",
    from: "Site Studio <no-reply@site-studio.dev>",
    fetcher,
  });

const ResendBody = Schema.fromJsonString(
  Schema.Struct({
    from: Schema.String,
    to: Schema.String,
    subject: Schema.String,
    text: Schema.String,
    html: Schema.String,
  }),
);

describe("EmailSender", () => {
  it("noop sender logs the unconfigured path and succeeds", async () => {
    const messages: Array<string> = [];
    const logger = Logger.make<unknown, void>(({ message }) => {
      messages.push(String(message));
    });

    const result = await run(
      makeNoopEmailSender()
        .send(_message)
        .pipe(Effect.provide(Logger.layer([logger], { mergeWithExisting: false }))),
    );

    expect(result).toBeUndefined();
    expect(messages.some((message) => message.includes("email not configured"))).toBe(true);
  });

  it("resend sender posts the message with bearer auth", async () => {
    const { calls, fetcher } = _fakeFetch(() => Response.json({ id: "email_1" }));

    await run(_sender(fetcher).send(_message));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("authorization")).toBe("Bearer re_test_key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(Schema.decodeUnknownSync(ResendBody)(String(calls[0]!.init.body))).toEqual({
      from: "Site Studio <no-reply@site-studio.dev>",
      ..._message,
    });
  });

  it("fails with EmailError on a non-2xx response", async () => {
    const { fetcher } = _fakeFetch(() => new Response("denied", { status: 403 }));

    const failure = await run(Effect.flip(_sender(fetcher).send(_message)));

    expect(failure).toMatchObject({ _tag: "EmailError" });
    expect(failure.message).toContain("403");
  });

  it("fails with EmailError when the request throws", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("offline");
    };

    const failure = await run(Effect.flip(_sender(fetcher).send(_message)));

    expect(failure).toMatchObject({ _tag: "EmailError", cause: expect.any(Error) });
  });
});
