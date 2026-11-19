import { describe, expect, it } from "@effect/vitest";
import { listTemplateInfo, templateTier, toTemplateInfo } from "./templateDefaults.ts";
import { TEMPLATES } from "@site-studio/site-template/templates";

describe("template defaults", () => {
  it("makes the starter free and the rest Pro", () => {
    expect(templateTier("clean-grid")).toBe("free");
    expect(templateTier("editorial-studio")).toBe("pro");
    expect(templateTier("warm-minimal")).toBe("pro");
  });

  it("treats unknown templates as Pro", () => {
    expect(templateTier("not-a-template")).toBe("pro");
  });

  it("carries the tier through the gallery", () => {
    const cleanGrid = TEMPLATES.get("clean-grid")!;
    expect(toTemplateInfo(cleanGrid).tier).toBe("free");
    expect(listTemplateInfo().map((template) => [template.id, template.tier])).toEqual([
      ["editorial-studio", "pro"],
      ["warm-minimal", "pro"],
      ["clean-grid", "free"],
    ]);
  });
});
