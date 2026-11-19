import type { Plan } from "./billing.ts";
import { UpgradeRequired } from "./billing.ts";
import { templateTier } from "../site/templateDefaults.ts";

/** The plan-scoped action a request is asking for. */
export type PlanAction =
  | { readonly kind: "createSite"; readonly templateId: string }
  | {
      readonly kind: "updateSite";
      readonly templateId: string;
      /** Null when the site is not visible to the requester. */
      readonly currentTemplateId: string | null;
      readonly analytics: boolean;
    };

/** What the plan check needs to know about the account. */
export interface PlanContext {
  readonly plan: Plan;
  readonly siteCount: number;
}

/**
 * The feature the account's plan does not cover, or null when the action is
 * allowed. Pro accounts pass every gate.
 */
export const planGate = (action: PlanAction, context: PlanContext): UpgradeRequired | null => {
  if (context.plan === "pro") return null;
  if (action.kind === "createSite") {
    if (context.siteCount >= 1) return new UpgradeRequired({ feature: "sites" });
    return _templateGate(action.templateId, null);
  }
  return (
    _templateGate(action.templateId, action.currentTemplateId) ??
    (action.analytics ? new UpgradeRequired({ feature: "analytics" }) : null)
  );
};

/** A free account may keep its current Pro template; switching to one needs Pro. */
const _templateGate = (templateId: string, currentTemplateId: string | null) =>
  templateId !== currentTemplateId && templateTier(templateId) === "pro"
    ? new UpgradeRequired({ feature: "templates" })
    : null;
