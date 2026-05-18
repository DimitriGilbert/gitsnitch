import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { cliPackageMetadata, runCli } from "../src/index";

const execFileAsync = promisify(execFile);

describe("cli package entrypoint", () => {
  it("exports stable package metadata", () => {
    expect(cliPackageMetadata).toEqual({
      name: "@git-snitch/cli",
      role: "cli",
      version: "0.0.0",
    });
  });

  it("prints help and version for the commander entrypoint", async () => {
    const helpOutput = createBufferedOutput();
    const helpCode = await runCli(["--help"], { io: helpOutput.io });
    expect(helpCode).toBe(0);
    expect(helpOutput.stdout()).toContain("Commands:");
    expect(helpOutput.stdout()).toContain("repo");
    expect(helpOutput.stdout()).toContain("scan");

    const versionOutput = createBufferedOutput();
    const versionCode = await runCli(["--version"], { io: versionOutput.io });
    expect(versionCode).toBe(0);
    expect(versionOutput.stdout()).toContain("0.0.0");
  });

  it("emits repo JSON with the same report data shape used by HTML", async () => {
    const workspace = await createTempDirectory();
    const repoPath = await createFixtureRepo(workspace, "json-repo", "JSON fixture commit");
    const output = createBufferedOutput();

    const code = await runCli(["repo", repoPath, "--json"], { io: output.io });

    expect(code, output.stderr()).toBe(0);
    const parsed = JSON.parse(output.stdout()) as { readonly kind?: string; readonly repository?: { readonly name?: string } };
    expect(parsed.kind).toBe("repo");
    expect(parsed.repository?.name).toBe("json-repo");
    expect(output.stderr()).toBe("");
  });

  it("validates the exact repo JSON contract, config loading, and CLI branch override precedence", async () => {
    const workspace = await createTempDirectory();
    const repoPath = await createBranchingFixtureRepo(workspace, "schema-repo", {
      mainMessage: "main schema commit",
      featureMessage: "feature schema commit",
    });
    await writeGitSnitchConfig(repoPath, { repo: { branches: ["feature/reporting"] } });

    const configuredOutput = createBufferedOutput();
    const configuredCode = await runCli(["repo", repoPath, "--json"], { io: configuredOutput.io });

    expect(configuredCode, configuredOutput.stderr()).toBe(0);
    const configuredReport = parseRecord(configuredOutput.stdout());
    expectExactKeys(configuredReport, ["analysis", "commits", "contributors", "generatedAt", "kind", "options", "repository"]);
    expectExactKeys(getRecord(configuredReport, "repository"), ["currentBranch", "firstCommitAt", "lastCommitAt", "name", "path", "rootPath", "totalCommits", "totalContributors"]);
    expectExactKeys(getRecord(configuredReport, "options"), ["allBranches", "branches", "format", "open", "overwrite", "repoPath"]);
    expectExactKeys(getRecord(configuredReport, "analysis"), ["cadence", "hotspots", "languages", "qualitySignals"]);
    expectExactKeys(firstRecord(getRecordArray(configuredReport, "commits"), "commits"), ["author", "authoredAt", "classification", "committedAt", "files", "hash", "message", "parents", "refs", "shortHash"]);
    expectExactKeys(firstRecord(getRecordArray(configuredReport, "contributors"), "contributors"), ["additions", "commitCount", "deletions", "email", "filesChanged", "firstCommitAt", "lastCommitAt", "name"]);
    expect(configuredReport.kind).toBe("repo");
    expect(getRecord(configuredReport, "options").branches).toEqual(["feature/reporting"]);
    expect(getRecordArray(configuredReport, "commits").map((commit) => getString(commit, "message"))).toEqual(["feature schema commit", "main schema commit"]);

    const overrideOutput = createBufferedOutput();
    const overrideCode = await runCli(["repo", repoPath, "--json", "--branch", "main"], { io: overrideOutput.io });

    expect(overrideCode, overrideOutput.stderr()).toBe(0);
    const overrideReport = parseRecord(overrideOutput.stdout());
    expect(getRecord(overrideReport, "options").branches).toEqual(["main"]);
    expect(getRecordArray(overrideReport, "commits").map((commit) => getString(commit, "message"))).toEqual(["main schema commit"]);
  }, 120_000);

  it("writes repo HTML with navigation, charts, tables, exports, theme controls, custom fallback code, and safe injected data", async () => {
    const workspace = await createTempDirectory();
    const unsafeMessage = "unsafe </script><img src=x onerror=alert(1)> & \u2028 \u2029 content";
    const repoPath = await createBranchingFixtureRepo(workspace, "html-contract-repo", {
      mainMessage: unsafeMessage,
      featureMessage: "feature report commit",
    });
    const outputPath = join(workspace, "repo-contract.html");
    const templatePath = join(workspace, "partial-template.tsx");
    await writeFile(
      templatePath,
      [
        "import type { RouteTemplateOverrides } from '@git-snitch/renderer/template';",
        "export const templates = {",
        "  overview: ({ report }) => <section data-e2e=\"custom-overview\">custom overview for {report.repository.name}</section>,",
        "} satisfies RouteTemplateOverrides;",
      ].join("\n"),
      "utf8",
    );
    const output = createBufferedOutput();

    const code = await runCli(["repo", repoPath, "--output", outputPath, "--template", templatePath], { io: output.io });

    expect(code, output.stderr()).toBe(0);
    const html = await readFile(outputPath, "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("#/overview");
    expect(html).toContain("#/commits");
    expect(html).toContain("#/contributors");
    expect(html).toContain("#/charts");
    expect(html).toContain("Switch to dark theme");
    expect(html).toContain("Charts use only the injected standalone report payload");
    expect(html).toContain("Searchable, sortable commit evidence");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Export JSON");
    expect(html).toContain("custom overview for");
    expect(html).toContain("Commits ledger");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html).toContain("\\u003cimg src=x onerror=alert(1)\\u003e");
    expect(html).toContain("\\u0026");
    expect(html).toContain("\\u2028");
    expect(html).toContain("\\u2029");
    expect(html).not.toContain(unsafeMessage);
    expect(html).not.toContain("</script><img");

    const injectedReport = extractInjectedReport(html);
    expect(injectedReport.kind).toBe("repo");
    expect(getRecord(injectedReport, "repository").name).toBe("html-contract-repo");
  }, 120_000);

  it("writes standalone repo HTML, supports custom templates, explicit open, and overwrite protection", async () => {
    const workspace = await createTempDirectory();
    const repoPath = await createFixtureRepo(workspace, "html-repo", "HTML fixture commit </script> & more");
    const outputPath = join(workspace, "report.html");
    const templatePath = join(workspace, "custom-template.tsx");
    await writeFile(
      templatePath,
      [
        "import type { RouteTemplateOverrides } from '@git-snitch/renderer/template';",
        "export const templates = {",
        "  overview: ({ report }) => <section>custom-overview-{report.repository.name}</section>,",
        "} satisfies RouteTemplateOverrides;",
      ].join("\n"),
      "utf8",
    );
    const openedPaths: string[] = [];
    const output = createBufferedOutput();

    const code = await runCli(["repo", repoPath, "--output", outputPath, "--template", templatePath, "--open"], {
      io: output.io,
      opener: async (filePath) => {
        openedPaths.push(filePath);
      },
    });

    expect(code, output.stderr()).toBe(0);
    expect(openedPaths).toEqual([outputPath]);
    const html = await readFile(outputPath, "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("custom-overview-");
    expect(html).toContain("\u003c/script\u003e");

    const protectedOutput = createBufferedOutput();
    const protectedCode = await runCli(["repo", repoPath, "--output", outputPath, "--no-overwrite"], { io: protectedOutput.io });
    expect(protectedCode).toBe(1);
    expect(protectedOutput.stderr()).toContain("Output file already exists");

    const previousDirectory = process.cwd();
    process.chdir(workspace);
    try {
      const deterministicOutput = createBufferedOutput();
      const deterministicCode = await runCli(["repo", repoPath], { io: deterministicOutput.io });
      expect(deterministicCode, deterministicOutput.stderr()).toBe(0);
      expect(await readFile(join(workspace, "git-snitch-repo-html-repo.html"), "utf8")).toContain("<!doctype html>");
    } finally {
      process.chdir(previousDirectory);
    }
  }, 120_000);

  it("writes standalone scan HTML for multiple generated repositories", async () => {
    const workspace = await createTempDirectory();
    await mkdir(join(workspace, "group"), { recursive: true });
    await createFixtureRepo(join(workspace, "group"), "first-repo", "First scan commit");
    await createFixtureRepo(join(workspace, "group"), "second-repo", "Second scan commit");
    const outputPath = join(workspace, "scan.html");
    const output = createBufferedOutput();

    const code = await runCli(["scan", join(workspace, "group"), "--output", outputPath], { io: output.io });

    expect(code, output.stderr()).toBe(0);
    const html = await readFile(outputPath, "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('"kind":"scan"');
    expect(html).toContain("first-repo");
    expect(html).toContain("second-repo");
  }, 120_000);

  it("writes scan HTML with aggregate stats, project drill-down links, cross-project contributors, and empty scan state", async () => {
    const workspace = await createTempDirectory();
    const scanRoot = join(workspace, "scan-contract");
    await mkdir(scanRoot, { recursive: true });
    await createFixtureRepo(scanRoot, "alpha-repo", "alpha shared contributor commit");
    await createFixtureRepo(scanRoot, "beta-repo", "beta shared contributor commit");
    const scanOutputPath = join(workspace, "scan-contract.html");
    const scanOutput = createBufferedOutput();

    const scanCode = await runCli(["scan", scanRoot, "--output", scanOutputPath], { io: scanOutput.io });

    expect(scanCode, scanOutput.stderr()).toBe(0);
    const scanHtml = await readFile(scanOutputPath, "utf8");
    expect(scanHtml).toContain("Scan overview");
    expect(scanHtml).toContain("Project comparison");
    expect(scanHtml).toContain("Cross-project contributors");
    expect(scanHtml).toContain("#/scan/projects/");
    expect(scanHtml).toContain("alpha-repo");
    expect(scanHtml).toContain("beta-repo");
    const scanReport = extractInjectedReport(scanHtml);
    expect(scanReport.kind).toBe("scan");
    expectExactKeys(scanReport, ["analysis", "directory", "generatedAt", "kind", "options", "projects"]);
    expect(getRecord(scanReport, "analysis").totalRepositories).toBe(2);
    expect(getRecord(scanReport, "analysis").totalContributors).toBe(1);

    const emptyRoot = join(workspace, "empty-scan");
    await mkdir(emptyRoot, { recursive: true });
    const emptyOutputPath = join(workspace, "empty-scan.html");
    const emptyOutput = createBufferedOutput();
    const emptyCode = await runCli(["scan", emptyRoot, "--output", emptyOutputPath], { io: emptyOutput.io });

    expect(emptyCode, emptyOutput.stderr()).toBe(0);
    const emptyHtml = await readFile(emptyOutputPath, "utf8");
    expect(emptyHtml).toContain("No repositories matched this scan");
    expect(getRecordArray(extractInjectedReport(emptyHtml), "projects")).toEqual([]);
  }, 120_000);

  it("validates scan JSON schema and config maxDepth override precedence", async () => {
    const workspace = await createTempDirectory();
    const scanRoot = join(workspace, "max-depth-scan");
    const nestedParent = join(scanRoot, "level-one", "level-two");
    await mkdir(nestedParent, { recursive: true });
    await createFixtureRepo(nestedParent, "deep-repo", "deep scan commit");
    await writeGitSnitchConfig(scanRoot, { scan: { maxDepth: 1 } });

    const configuredOutput = createBufferedOutput();
    const configuredCode = await runCli(["scan", scanRoot, "--json"], { io: configuredOutput.io });

    expect(configuredCode, configuredOutput.stderr()).toBe(0);
    expect(getRecordArray(parseRecord(configuredOutput.stdout()), "projects")).toEqual([]);

    const overrideOutput = createBufferedOutput();
    const overrideCode = await runCli(["scan", scanRoot, "--json", "--max-depth", "3"], { io: overrideOutput.io });

    expect(overrideCode, overrideOutput.stderr()).toBe(0);
    const overrideReport = parseRecord(overrideOutput.stdout());
    expectExactKeys(overrideReport, ["analysis", "directory", "generatedAt", "kind", "options", "projects"]);
    expectExactKeys(getRecord(overrideReport, "analysis"), ["languages", "qualitySignals", "totalCommits", "totalContributors", "totalRepositories"]);
    expectExactKeys(getRecord(overrideReport, "options"), ["directory", "format", "open", "overwrite", "scan"]);
    expectExactKeys(getRecord(getRecord(overrideReport, "options"), "scan"), ["excludePatterns", "includePatterns", "maxDepth"]);
    expectExactKeys(firstRecord(getRecordArray(overrideReport, "projects"), "projects"), ["report", "repository"]);
    expect(getRecord(getRecord(overrideReport, "options"), "scan").maxDepth).toBe(3);
    expect(getRecordArray(overrideReport, "projects")).toHaveLength(1);
  }, 120_000);

  it("declares npm package files required for the CLI release and excludes test-only paths", async () => {
    const repositoryRoot = join(process.cwd(), "../..");
    const cliPackage = await readPackageJson(join(repositoryRoot, "apps/cli/package.json"));
    const corePackage = await readPackageJson(join(repositoryRoot, "packages/core/package.json"));
    const rendererPackage = await readPackageJson(join(repositoryRoot, "packages/renderer/package.json"));
    const uiPackage = await readPackageJson(join(repositoryRoot, "packages/ui/package.json"));
    const webPackage = await readPackageJson(join(repositoryRoot, "apps/web/package.json"));

    expect(getStringArray(cliPackage, "files")).toEqual(["dist", "package.json"]);
    expect(getStringArray(corePackage, "files")).toEqual(["dist", "src", "package.json"]);
    expect(getStringArray(rendererPackage, "files")).toEqual(["dist", "report-template.html", "src", "vite.config.ts", "package.json"]);
    expect(getStringArray(uiPackage, "files")).toEqual(["src", "postcss.config.mjs", "package.json"]);
    expect(getRecord(getRecord(rendererPackage, "exports"), "./build")).toMatchObject({ types: "./src/build.ts", default: "./dist/build.js" });
    expect(getString(getRecord(rendererPackage, "dependencies"), "@tailwindcss/vite")).toBe("^4.2.2");
    expect(getString(getRecord(rendererPackage, "dependencies"), "@vitejs/plugin-react")).toBe("^6.0.1");
    expect(getRecord(rendererPackage, "devDependencies")["@tailwindcss/vite"]).toBeUndefined();
    expect(getRecord(rendererPackage, "devDependencies")["@vitejs/plugin-react"]).toBeUndefined();
    expect(webPackage.private).toBe(true);

    for (const packageJson of [cliPackage, corePackage, rendererPackage, uiPackage]) {
      const files = getStringArray(packageJson, "files");
      expect(packageJson.private).toBeUndefined();
      expect(getRecord(packageJson, "publishConfig").access).toBe("public");
      expect(files).not.toContain("test");
      expect(files).not.toContain("node_modules");
      expect(files).not.toContain("tsconfig.json");
    }
  });

  it("keeps published runtime packages free of private workspace dependencies", async () => {
    const repositoryRoot = join(process.cwd(), "../..");
    const packagePaths = [
      "apps/cli/package.json",
      "apps/web/package.json",
      "packages/config/package.json",
      "packages/core/package.json",
      "packages/env/package.json",
      "packages/renderer/package.json",
      "packages/ui/package.json",
    ];
    const workspacePackages = await Promise.all(
      packagePaths.map(async (packagePath) => ({
        packagePath,
        manifest: await readPackageJson(join(repositoryRoot, packagePath)),
      })),
    );
    const privateWorkspacePackages = new Set(
      workspacePackages
        .filter(({ manifest }) => manifest.private === true)
        .map(({ manifest }) => getString(manifest, "name")),
    );
    const publishablePackages = workspacePackages.filter(({ manifest }) => manifest.private !== true && getRecord(manifest, "publishConfig").access === "public");
    const runtimeDependencyFields = ["dependencies", "optionalDependencies", "peerDependencies"] as const;

    for (const { manifest } of publishablePackages) {
      for (const dependencyField of runtimeDependencyFields) {
        const dependencies = getOptionalRecord(manifest, dependencyField);
        for (const [dependencyName, dependencyRange] of Object.entries(dependencies)) {
          expect(privateWorkspacePackages.has(dependencyName), `${getString(manifest, "name")} ${dependencyField} references private workspace package ${dependencyName}`).toBe(false);
          if (typeof dependencyRange === "string" && dependencyRange.startsWith("workspace:")) {
            const workspaceDependency = workspacePackages.find(({ manifest: workspaceManifest }) => getString(workspaceManifest, "name") === dependencyName);
            expect(workspaceDependency, `${getString(manifest, "name")} ${dependencyField} references unknown workspace package ${dependencyName}`).toBeDefined();
            expect(workspaceDependency?.manifest.private, `${getString(manifest, "name")} ${dependencyField} references private workspace package ${dependencyName}`).not.toBe(true);
          }
        }
      }
    }
  });

  it("documents Phase 12 release validation browser residual risks", async () => {
    const repositoryRoot = join(process.cwd(), "../..");
    const releaseValidation = await readFile(join(repositoryRoot, "docs/release-validation.md"), "utf8");

    expect(releaseValidation).toContain("generated HTML/content-level and jsdom/component tests");
    expect(releaseValidation).toContain("does not currently run real browser or `file://` end-to-end automation");
    expect(releaseValidation).toContain("actual `file://` hash routing");
    expect(releaseValidation).toContain("theme toggle behavior in a standalone browser");
    expect(releaseValidation).toContain("CSV and JSON downloads in a real browser");
    expect(releaseValidation).toContain("custom-template standalone execution in a real browser");
    expect(releaseValidation).toContain("accepted for v1");
    expect(releaseValidation).toContain("future real-browser E2E follow-up");
  });

  it("does not open repo reports unless --open is supplied, even when config enables report.open", async () => {
    const workspace = await createTempDirectory();
    const repoPath = await createFixtureRepo(workspace, "configured-repo", "Configured repo commit");
    await writeGitSnitchConfig(repoPath, { report: { open: true } });
    const outputPath = join(workspace, "configured-repo.html");
    const openedPaths: string[] = [];
    const output = createBufferedOutput();

    const code = await runCli(["repo", repoPath, "--output", outputPath], {
      io: output.io,
      opener: async (filePath) => {
        openedPaths.push(filePath);
      },
    });

    expect(code, output.stderr()).toBe(0);
    expect(await readFile(outputPath, "utf8")).toContain("<!doctype html>");
    expect(openedPaths).toEqual([]);
  }, 120_000);

  it("does not open scan reports unless --open is supplied, even when config enables report.open", async () => {
    const workspace = await createTempDirectory();
    const scanRoot = join(workspace, "configured-group");
    await mkdir(scanRoot, { recursive: true });
    await createFixtureRepo(scanRoot, "configured-first", "Configured first scan commit");
    await writeGitSnitchConfig(scanRoot, { report: { open: true } });
    const outputPath = join(workspace, "configured-scan.html");
    const openedPaths: string[] = [];
    const output = createBufferedOutput();

    const code = await runCli(["scan", scanRoot, "--output", outputPath], {
      io: output.io,
      opener: async (filePath) => {
        openedPaths.push(filePath);
      },
    });

    expect(code, output.stderr()).toBe(0);
    expect(await readFile(outputPath, "utf8")).toContain("<!doctype html>");
    expect(openedPaths).toEqual([]);
  }, 120_000);

  it("reports invalid options and template compile failures clearly", async () => {
    const workspace = await createTempDirectory();
    const repoPath = await createFixtureRepo(workspace, "failure-repo", "Failure fixture commit");
    const invalidOptions = createBufferedOutput();
    const invalidOptionsCode = await runCli(["repo", repoPath, "--branch", "main", "--all-branches"], { io: invalidOptions.io });
    expect(invalidOptionsCode).toBe(1);
    expect(invalidOptions.stderr()).toContain("use either --branch or --all-branches");

    const legacyAlias = createBufferedOutput();
    const legacyAliasCode = await runCli(["snitch", repoPath], { io: legacyAlias.io });
    expect(legacyAliasCode).toBe(1);
    expect(legacyAlias.stderr()).toContain("Use `git-snitch repo`, `git-snitch scan`, or `git-snitch worklog`");

    const brokenTemplatePath = join(workspace, "broken.tsx");
    await writeFile(brokenTemplatePath, "export const templates = { overview: () => <section>broken</section ", "utf8");
    const brokenTemplate = createBufferedOutput();
    const brokenTemplateCode = await runCli(["repo", repoPath, "--output", join(workspace, "broken.html"), "--template", brokenTemplatePath], {
      io: brokenTemplate.io,
    });
    expect(brokenTemplateCode).toBe(1);
    expect(brokenTemplate.stderr()).toContain("Unable to compile report renderer with template");
  }, 120_000);
});

function createBufferedOutput() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: {
      stdout: (text: string) => out.push(text),
      stderr: (text: string) => err.push(text),
    },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

async function readPackageJson(path: string): Promise<JsonRecord> {
  return parseRecord(await readFile(path, "utf8"));
}

async function createTempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "git-snitch-cli-"));
}

async function createFixtureRepo(parentDirectory: string, name: string, message: string): Promise<string> {
  const repoPath = join(parentDirectory, name);
  await mkdir(repoPath, { recursive: true });
  await git(repoPath, ["init", "-b", "main"]);
  await git(repoPath, ["config", "user.name", "Fixture Author"]);
  await git(repoPath, ["config", "user.email", "fixture@example.test"]);
  await writeFile(join(repoPath, "README.md"), `# ${name}\n`, "utf8");
  await git(repoPath, ["add", "README.md"]);
  await git(repoPath, ["commit", "-m", message], {
    GIT_AUTHOR_DATE: "2024-01-02T03:04:05Z",
    GIT_COMMITTER_DATE: "2024-01-02T03:04:05Z",
  });
  return repoPath;
}

async function createBranchingFixtureRepo(
  parentDirectory: string,
  name: string,
  messages: { readonly mainMessage: string; readonly featureMessage: string },
): Promise<string> {
  const repoPath = join(parentDirectory, name);
  await mkdir(repoPath, { recursive: true });
  await git(repoPath, ["init", "-b", "main"]);
  await git(repoPath, ["config", "user.name", "Fixture Author"]);
  await git(repoPath, ["config", "user.email", "fixture@example.test"]);
  await writeFile(join(repoPath, "README.md"), `# ${name}\n`, "utf8");
  await git(repoPath, ["add", "README.md"]);
  await git(repoPath, ["commit", "-m", messages.mainMessage], {
    GIT_AUTHOR_DATE: "2024-01-02T03:04:05Z",
    GIT_COMMITTER_DATE: "2024-01-02T03:04:05Z",
  });
  await git(repoPath, ["checkout", "-b", "feature/reporting"]);
  await writeFile(join(repoPath, "feature.ts"), "export const feature = 'reporting';\n", "utf8");
  await git(repoPath, ["add", "feature.ts"]);
  await git(repoPath, ["commit", "-m", messages.featureMessage], {
    GIT_AUTHOR_DATE: "2024-01-03T03:04:05Z",
    GIT_COMMITTER_DATE: "2024-01-03T03:04:05Z",
  });
  await git(repoPath, ["checkout", "main"]);
  return repoPath;
}

type TestConfig = {
  readonly repo?: { readonly branches?: readonly string[] };
  readonly scan?: { readonly maxDepth?: number };
  readonly report?: { readonly open?: boolean };
};

async function writeGitSnitchConfig(baseDirectory: string, config: TestConfig): Promise<void> {
  const configDirectory = join(baseDirectory, ".git-snitch");
  await mkdir(configDirectory, { recursive: true });
  await writeFile(join(configDirectory, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function git(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv = {}): Promise<void> {
  await execFileAsync("git", [...args], {
    cwd,
    env: { ...process.env, ...env, GIT_AUTHOR_NAME: "Fixture Author", GIT_AUTHOR_EMAIL: "fixture@example.test" },
  });
}

type JsonRecord = Readonly<Record<string, unknown>>;

function parseRecord(json: string): JsonRecord {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) {
    throw new Error("Expected JSON object.");
  }
  return parsed;
}

function extractInjectedReport(html: string): JsonRecord {
  const match = /window\.__GIT_SNITCH_REPORT_DATA__ = (.*);/.exec(html);
  if (!match?.[1]) {
    throw new Error("Expected injected report data assignment in generated HTML.");
  }
  return parseRecord(match[1]);
}

function expectExactKeys(record: JsonRecord, keys: readonly string[]): void {
  expect(Object.keys(record).sort()).toEqual([...keys].sort());
}

function getRecord(record: JsonRecord, key: string): JsonRecord {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`Expected ${key} to be an object.`);
  }
  return value;
}

function getOptionalRecord(record: JsonRecord, key: string): JsonRecord {
  const value = record[key];
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error(`Expected ${key} to be an object.`);
  }
  return value;
}

function getRecordArray(record: JsonRecord, key: string): readonly JsonRecord[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Expected ${key} to be an object array.`);
  }
  return value;
}

function getString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string.`);
  }
  return value;
}

function getStringArray(record: JsonRecord, key: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`Expected ${key} to be a string array.`);
  }
  return value;
}

function firstRecord(records: readonly JsonRecord[], label: string): JsonRecord {
  const record = records.at(0);
  if (record === undefined) {
    throw new Error(`Expected ${label} to include at least one object.`);
  }
  return record;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
