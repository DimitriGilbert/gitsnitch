import { describe, expect, it } from "vitest";

import { rendererPackageMetadata } from "../src/index";

describe("renderer package entrypoint", () => {
  it("exports stable package metadata", () => {
    expect(rendererPackageMetadata).toEqual({
      name: "@git-snitch/renderer",
      role: "renderer",
      version: "0.0.0",
    });
  });
});
