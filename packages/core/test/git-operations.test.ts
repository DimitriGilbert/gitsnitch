import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import type { AsyncCommandRunner, CommandResult } from "../src/index";

import {
  buildGitLogArgs,
  countLinesOfCode,
  createGitCommandRunner,
  discoverGitRepositories,
  getCommitBranches,
  getCurrentBranch,
  getGitCommits,
  getRepositoryInfo,
  normalizeRemoteUrl,
} from "../src/index";

const execFileAsync = promisify(execFile);

describe("git log operations", () => {
  it("returns no commits for empty git log output", async () => {
    const commits = await getGitCommits({
      repoPath: "/repo",
      branches: ["main"],
      runner: createStaticRunner({ stdout: "", stderr: "" }),
    });

    expect(commits).toEqual([]);
  });

  it("skips malformed records while preserving file stats from valid records", async () => {
    const output = [
      "malformed line",
      [
        "abc123\u001fabc123\u001fAda\u001fada@example.test\u001f2024-01-02T03:04:05+00:00\u001f2024-01-02T03:04:06+00:00\u001f\u001fHEAD -> main\u001ffix: repair parser\u001fBody text",
        "12\t3\tsrc/parser.ts",
        "-\t-\tpublic/logo.png",
        "not-a-stat-line",
      ].join("\n"),
    ].join("\u001e");

    const commits = await getGitCommits({
      repoPath: "/repo",
      branches: ["main"],
      runner: createStaticRunner({ stdout: output, stderr: "" }),
    });

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      hash: "abc123",
      message: "fix: repair parser",
      classification: "other",
      files: [
        { path: "src/parser.ts", additions: 12, deletions: 3, status: "modified" },
        { path: "public/logo.png", additions: 0, deletions: 0, status: "modified" },
      ],
    });
  });

  it("constructs branch-specific and all-branch git log commands", () => {
    expect(buildGitLogArgs({ branches: ["main", "release"], since: "2024-01-01T00:00:00.000Z" })).toContain("main");
    expect(buildGitLogArgs({ branches: ["main", "release"] })).toContain("release");
    expect(buildGitLogArgs({ allBranches: true, branches: ["main"] })).toContain("--all");
    expect(buildGitLogArgs({ allBranches: true, branches: ["main"] })).not.toContain("main");
  });

  it("adds git-side author and committer exclusion filters", () => {
    const args = buildGitLogArgs({
      branches: ["main"],
      excludeAuthors: ["deploy-bot", "ci@example.test"],
      excludeCommitters: ["rebase-bot"],
    });

    expect(args).toContain("--perl-regexp");
    expect(args).toContain("--author=^(?!.*(?:deploy-bot|ci@example\\.test))");
    expect(args).toContain("--committer=^(?!.*(?:rebase-bot))");
  });

  it("omits exclusion filters when no usable patterns are given", () => {
    const args = buildGitLogArgs({ branches: ["main"], excludeAuthors: [], excludeCommitters: ["   "] });

    expect(args).not.toContain("--perl-regexp");
    expect(args.some((arg) => arg.startsWith("--author=") || arg.startsWith("--committer="))).toBe(false);
  });

  it("excludes commits by author and committer patterns", async () => {
    const repoPath = await createTempDirectory("exclude-authors-");
    await git(repoPath, "init", "--initial-branch=main");
    await writeFile(join(repoPath, "index.ts"), "export const value = 1;\n");
    await commitAs(repoPath, "Ada Lovelace", "ada@example.test", "Ada Lovelace", "ada@example.test", ["index.ts"], "feat: human commit");
    await writeFile(join(repoPath, "bot.ts"), "export const bot = 1;\n");
    await commitAs(repoPath, "Deploy Bot", "deploy-bot@example.test", "Ada Lovelace", "ada@example.test", ["bot.ts"], "chore: bot authored");
    await writeFile(join(repoPath, "rebased.ts"), "export const rebased = 1;\n");
    await commitAs(repoPath, "Ada Lovelace", "ada@example.test", "Rebase Bot", "rebase-bot@example.test", ["rebased.ts"], "feat: bot committed");

    const commits = await getGitCommits({
      repoPath,
      runner: createGitCommandRunner(),
      excludeAuthors: ["deploy-bot"],
      excludeCommitters: ["rebase-bot"],
    });

    expect(commits.map((commit) => commit.message)).toEqual(["feat: human commit"]);
  });

  it("defaults to the current branch when no branch option is supplied", async () => {
    const calls: string[][] = [];
    const runner: AsyncCommandRunner = async (_command, args) => {
      calls.push([...args]);
      if (args[0] === "branch") {
        return { stdout: "main\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    await getGitCommits({ repoPath: "/repo", runner });

    expect(calls).toEqual([
      ["branch", "--show-current"],
      expect.arrayContaining(["log", "main"]),
    ]);
  });
});

describe("repository metadata operations", () => {
  it("normalizes common remote URL formats", () => {
    expect(normalizeRemoteUrl("git@github.com:owner/repo.git")).toBe("https://github.com/owner/repo");
    expect(normalizeRemoteUrl("ssh://git@github.com/owner/repo.git")).toBe("https://github.com/owner/repo");
    expect(normalizeRemoteUrl("https://github.com/owner/repo.git")).toBe("https://github.com/owner/repo");
    expect(normalizeRemoteUrl("")).toBeUndefined();
  });

  it("returns repository information without a remote when origin is missing", async () => {
    const repoPath = await createTempDirectory("missing-remote-");
    await git(repoPath, "init", "--initial-branch=main");

    const info = await getRepositoryInfo({ repoPath, runner: createGitCommandRunner() });

    expect(info).toMatchObject({ name: repoPath.split("/").at(-1), path: repoPath, rootPath: repoPath, currentBranch: "main" });
    expect(info.remoteUrl).toBeUndefined();
  });

  it("looks up local and remote branches that contain a commit", async () => {
    const repoPath = await createCommittedRepo("branches-");
    await git(repoPath, "branch", "feature");

    const commitHash = (await git(repoPath, "rev-parse", "HEAD")).trim();
    const branches = await getCommitBranches({ repoPath, commitHash, runner: createGitCommandRunner() });

    expect(branches).toEqual(expect.arrayContaining(["main", "feature"]));
  });

  it("handles empty repositories without commits", async () => {
    const repoPath = await createTempDirectory("empty-repo-");
    await git(repoPath, "init", "--initial-branch=main");

    await expect(getCurrentBranch({ repoPath, runner: createGitCommandRunner() })).resolves.toBe("main");
    await expect(getGitCommits({ repoPath, runner: createGitCommandRunner() })).resolves.toEqual([]);
  });
});

describe("repository discovery", () => {
  it("discovers nested git repositories with maxDepth defaulting to three", async () => {
    const workspace = await createTempDirectory("discover-");
    const nested = join(workspace, "apps", "service", "api");
    await mkdir(nested, { recursive: true });
    await git(workspace, "init", "--initial-branch=main");
    await git(nested, "init", "--initial-branch=main");

    await mkdir(join(workspace, "too", "deep", "for", "default"), { recursive: true });
    await git(join(workspace, "too", "deep", "for", "default"), "init", "--initial-branch=main");

    const repos = await discoverGitRepositories(workspace);

    expect(repos.map((repo) => repo.relativePath)).toEqual([".", "apps/service/api"]);
  });

  it("applies default noisy directory excludes and user exclude additions", async () => {
    const workspace = await createTempDirectory("excludes-");
    const nodeModulesRepo = join(workspace, "node_modules", "dependency");
    const vendorRepo = join(workspace, "vendor", "ignored");
    const keptRepo = join(workspace, "packages", "kept");
    await mkdir(nodeModulesRepo, { recursive: true });
    await mkdir(vendorRepo, { recursive: true });
    await mkdir(keptRepo, { recursive: true });
    await git(nodeModulesRepo, "init", "--initial-branch=main");
    await git(vendorRepo, "init", "--initial-branch=main");
    await git(keptRepo, "init", "--initial-branch=main");

    const repos = await discoverGitRepositories(workspace, { exclude: ["packages"] });

    expect(repos).toEqual([]);
  });
});

describe("line counting", () => {
  it("counts known source files and reports unknown or unreadable files as skipped", async () => {
    const repoPath = await createTempDirectory("loc-");
    await writeFile(join(repoPath, "index.ts"), ["const value = 1;", "", "// a comment", "export { value };", ""].join("\n"));
    await writeFile(join(repoPath, "README.md"), "# ignored\n");
    const unreadablePath = join(repoPath, "secret.py");
    await writeFile(unreadablePath, "print('hidden')\n");
    await chmod(unreadablePath, 0o000);

    try {
      const result = await countLinesOfCode(repoPath);

      expect(result.totalSource).toBe(2);
      expect(result.byLanguage).toEqual([
        { language: "TypeScript", files: 1, source: 2, blank: 2, comment: 1, total: 5 },
      ]);
      expect(result.skippedFiles).toEqual(
        expect.arrayContaining([
          { path: "README.md", reason: "unknown-language" },
          { path: "secret.py", reason: "unreadable" },
        ]),
      );
    } finally {
      await chmod(unreadablePath, 0o600);
    }
  });
});

function createStaticRunner(result: CommandResult): AsyncCommandRunner {
  return async () => result;
}

async function createTempDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `git-snitch-${prefix}`));
}

async function createCommittedRepo(prefix: string): Promise<string> {
  const repoPath = await createTempDirectory(prefix);
  await git(repoPath, "init", "--initial-branch=main");
  await git(repoPath, "config", "user.name", "Ada Lovelace");
  await git(repoPath, "config", "user.email", "ada@example.test");
  await writeFile(join(repoPath, "index.ts"), "export const value = 1;\n");
  await gitWithEnv(repoPath, ["add", "index.ts"]);
  await gitWithEnv(repoPath, ["commit", "-m", "feat: initial commit"]);
  return repoPath;
}

async function git(cwd: string, ...args: readonly string[]): Promise<string> {
  return gitWithEnv(cwd, args);
}

async function commitAs(
  cwd: string,
  authorName: string,
  authorEmail: string,
  committerName: string,
  committerEmail: string,
  files: readonly string[],
  message: string,
): Promise<void> {
  await execFileAsync("git", ["add", ...files], { cwd, encoding: "utf8" });
  await execFileAsync("git", ["commit", "-m", message], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_AUTHOR_DATE: "2024-01-02T03:04:05+00:00",
      GIT_COMMITTER_NAME: committerName,
      GIT_COMMITTER_EMAIL: committerEmail,
      GIT_COMMITTER_DATE: "2024-01-02T03:04:05+00:00",
    },
  });
}

async function gitWithEnv(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Ada Lovelace",
      GIT_AUTHOR_EMAIL: "ada@example.test",
      GIT_AUTHOR_DATE: "2024-01-02T03:04:05+00:00",
      GIT_COMMITTER_NAME: "Ada Lovelace",
      GIT_COMMITTER_EMAIL: "ada@example.test",
      GIT_COMMITTER_DATE: "2024-01-02T03:04:05+00:00",
    },
  });
  return result.stdout;
}
