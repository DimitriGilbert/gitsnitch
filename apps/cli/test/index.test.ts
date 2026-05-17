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
    expect(legacyAlias.stderr()).toContain("Use only `git-snitch repo` or `git-snitch scan`");

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

async function writeGitSnitchConfig(baseDirectory: string, config: { readonly report: { readonly open: boolean } }): Promise<void> {
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
