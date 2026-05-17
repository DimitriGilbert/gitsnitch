import { describe, expectTypeOf, it } from "vitest";

import type { RouteTemplateOverrides, TemplateModule } from "../src/template";

describe("template override contract", () => {
  it("accepts partial route-level overrides with route-specific report props", () => {
    const overrides = {
      overview: (props) => props.report.kind,
      scanProject: (props) => props.projectId,
    } satisfies RouteTemplateOverrides;

    const module = { templates: overrides } satisfies TemplateModule;

    expectTypeOf(module.templates).toMatchTypeOf<RouteTemplateOverrides>();
  });
});
