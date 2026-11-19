import { describe, expect, it } from "@effect/vitest";
import { planGate, type PlanAction, type PlanContext } from "./planGates.ts";

const free: PlanContext = { plan: "free", siteCount: 0 };
const freeWithSite: PlanContext = { plan: "free", siteCount: 1 };
const pro: PlanContext = { plan: "pro", siteCount: 5 };

const _createWith = (templateId: string): PlanAction => ({ kind: "createSite", templateId });
const _updateTo = (
  templateId: string,
  currentTemplateId: string,
  analytics = false,
): PlanAction => ({
  kind: "updateSite",
  templateId,
  currentTemplateId,
  analytics,
});

const _feature = (action: PlanAction, context: PlanContext) =>
  planGate(action, context)?.feature ?? null;

describe("planGate", () => {
  it("lets a Free account create its first site from the free template", () => {
    expect(_feature(_createWith("clean-grid"), free)).toBeNull();
  });

  it("blocks a second site on Free", () => {
    expect(_feature(_createWith("clean-grid"), freeWithSite)).toBe("sites");
  });

  it("blocks creating a site from a Pro template on Free", () => {
    expect(_feature(_createWith("editorial-studio"), free)).toBe("templates");
  });

  it("lets Pro create freely", () => {
    expect(_feature(_createWith("editorial-studio"), pro)).toBeNull();
  });

  it("blocks switching a Free site onto a Pro template", () => {
    expect(_feature(_updateTo("editorial-studio", "clean-grid"), free)).toBe("templates");
  });

  it("lets a Free account keep and edit its existing Pro template", () => {
    expect(_feature(_updateTo("editorial-studio", "editorial-studio"), free)).toBeNull();
  });

  it("lets a Free account switch away from a Pro template", () => {
    expect(_feature(_updateTo("clean-grid", "editorial-studio"), free)).toBeNull();
  });

  it("blocks analytics on Free", () => {
    expect(_feature(_updateTo("clean-grid", "clean-grid", true), free)).toBe("analytics");
  });

  it("lets Pro use every template and analytics", () => {
    expect(_feature(_updateTo("editorial-studio", "clean-grid", true), pro)).toBeNull();
  });
});
