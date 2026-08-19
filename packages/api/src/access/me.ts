import * as HttpApi from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import { GlobalRole } from "./access.ts";

/** The signed-in user's own profile: id, email, and global account role. */
export const Me = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  role: GlobalRole,
});
export type Me = (typeof Me)["Type"];

const me = HttpApi.HttpApiEndpoint.get("me", "/", {
  success: Me,
});

export class MeGroup extends HttpApi.HttpApiGroup.make("Me").add(me).prefix("/api/me") {}
