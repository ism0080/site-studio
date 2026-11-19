import * as HttpApi from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import { TooManyRequests } from "../platform/rateLimit.ts";
import {
  BillingCustomerNotFound,
  BillingNotConfigured,
  BillingStatus,
  StripeError,
} from "./billing.ts";

const CheckoutInput = Schema.Struct({
  successUrl: Schema.String,
});

const PortalInput = Schema.Struct({
  returnUrl: Schema.String,
});

const SessionUrl = Schema.Struct({
  url: Schema.String,
});

const status = HttpApi.HttpApiEndpoint.get("status", "/status", {
  success: BillingStatus,
});

const checkout = HttpApi.HttpApiEndpoint.post("checkout", "/checkout", {
  payload: CheckoutInput,
  success: SessionUrl,
  error: Schema.Union([BillingNotConfigured, StripeError, TooManyRequests]),
});

const portal = HttpApi.HttpApiEndpoint.post("portal", "/portal", {
  payload: PortalInput,
  success: SessionUrl,
  error: Schema.Union([BillingNotConfigured, BillingCustomerNotFound, StripeError]),
});

export class BillingGroup extends HttpApi.HttpApiGroup.make("Billing")
  .add(status)
  .add(checkout)
  .add(portal)
  .prefix("/api/billing") {}
