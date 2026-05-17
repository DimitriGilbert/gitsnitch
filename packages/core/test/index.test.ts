import { describe, expect, it } from "vitest";

import { corePackageMetadata } from "../src/index";

describe("core package entrypoint", () => {
  it("exports stable package metadata", () => {
    expect(corePackageMetadata).toEqual({
      name: "@git-snitch/core",
      role: "core",
      version: "0.0.0",
    });
  });
});
