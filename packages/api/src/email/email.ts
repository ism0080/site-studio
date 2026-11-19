import * as Schema from "effect/Schema";

/** The email provider rejected the message or the request could not be made (502). */
export class EmailError extends Schema.TaggedErrorClass<EmailError>()(
  "EmailError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
  { httpApiStatus: 502 },
) {}

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}
