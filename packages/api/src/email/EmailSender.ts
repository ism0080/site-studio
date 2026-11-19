import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { EmailError, type EmailMessage } from "./email.ts";

export { EmailError } from "./email.ts";
export type { EmailMessage } from "./email.ts";

export interface EmailSenderService {
  readonly send: (message: EmailMessage) => Effect.Effect<void, EmailError>;
}

export class EmailSender extends Context.Service<EmailSender, EmailSenderService>()(
  "@app/EmailSender",
) {}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const ResendRequest = Schema.fromJsonString(
  Schema.Struct({
    from: Schema.String,
    to: Schema.String,
    subject: Schema.String,
    text: Schema.String,
    html: Schema.String,
  }),
);

/** Posts one message to Resend. No retries: a failed invite email fails the request. */
export const makeResendEmailSender = (deps: {
  readonly apiKey: string;
  readonly from: string;
  readonly fetcher: typeof fetch;
}): EmailSenderService => ({
  send: Effect.fn("EmailSender.send")(function* (message: EmailMessage) {
    const response = yield* Effect.tryPromise({
      try: () =>
        deps.fetcher(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${deps.apiKey}`,
            "Content-Type": "application/json",
          },
          body: Schema.encodeSync(ResendRequest)({
            from: deps.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        }),
      catch: (cause) => new EmailError({ message: "Resend request failed", cause }),
    });
    if (!response.ok) {
      return yield* new EmailError({
        message: `Resend rejected the email (${response.status})`,
      });
    }
  }),
});

/** Unconfigured deployments still store invites; they just do not send mail. */
export const makeNoopEmailSender = (): EmailSenderService => ({
  send: (message) =>
    Effect.logInfo(`email not configured; invite stored but not sent to ${message.to}`),
});

export const EmailEnv = {
  apiKey: Config.redacted("RESEND_API_KEY").pipe(Config.withDefault(Redacted.make(""))),
  from: Config.string("EMAIL_FROM").pipe(
    Config.withDefault("Site Studio <no-reply@site-studio.dev>"),
  ),
  webUrl: Config.string("WEB_URL").pipe(Config.withDefault("http://localhost:5173")),
};

export const EmailSenderLayer = Layer.effect(
  EmailSender,
  Effect.gen(function* () {
    const env = yield* Effect.all(EmailEnv);
    const apiKey = Redacted.value(env.apiKey);
    if (apiKey === "") return makeNoopEmailSender();
    return makeResendEmailSender({ apiKey, from: env.from, fetcher: globalThis.fetch });
  }),
);
