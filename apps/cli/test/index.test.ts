import { describe, expect, it } from "vitest";

import { cliPackageMetadata } from "../src/index";

describe("cli package entrypoint", () => {
  it("exports stable package metadata", () => {
    expect(cliPackageMetadata).toEqual({
      name: "@git-snitch/cli",
      role: "cli",
      version: "0.0.0",
    });
  });
});
