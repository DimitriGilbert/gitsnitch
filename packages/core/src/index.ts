export interface PackageMetadata {
  readonly name: "@git-snitch/core";
  readonly role: "core";
  readonly version: "0.0.0";
}

export const corePackageMetadata = {
  name: "@git-snitch/core",
  role: "core",
  version: "0.0.0",
} satisfies PackageMetadata;
