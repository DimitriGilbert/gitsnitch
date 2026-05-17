export interface PackageMetadata {
  readonly name: "@git-snitch/cli";
  readonly role: "cli";
  readonly version: "0.0.0";
}

export const cliPackageMetadata = {
  name: "@git-snitch/cli",
  role: "cli",
  version: "0.0.0",
} satisfies PackageMetadata;
