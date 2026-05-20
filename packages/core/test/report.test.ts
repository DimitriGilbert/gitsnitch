import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCAN_EXCLUDE_PATTERNS,
  GitSnitchConfigError,
  GitSnitchReportError,
  generateRepoReport,
  generateScanReport,
  isRepoReportData,
  isScanReportData,
  loadGitSnitchConfig,
  mergeGitSnitchConfig,
  parseScanPeriod,
} from "../src/index";

const execFileAsync = promisify(execFile);
const generatedAt = "2024-02-01T00:00:00.000Z";

describe("configuration loading and merging", () => {
  it("loads .git-snitch/config.json with defaults and validates clear errors", async () => {
    const workspace = await createTempDirectory("config-");
    await mkdir(join(workspace, ".git-snitch"), { recursive: true });
    await writeFile(
      join(workspace, ".git-snitch", "config.json"),
      JSON.stringify({ scan: { maxDepth: 5, excludePatterns: ["**/fixtures/**"] }, report: { format: "json" } }),
    );

    const config = await loadGitSnitchConfig(workspace);

    expect(config.scan.maxDepth).toBe(5);
    expect(config.scan.excludePatterns).toEqual(["**/fixtures/**"]);
    expect(config.report).toMatchObject({ format: "json", overwrite: true, open: false });
  });

  it("merges CLI overrides deeply while treating scan excludes as additions", () => {
    const merged = mergeGitSnitchConfig(undefined, {
      scan: { maxDepth: 8, excludePatterns: ["**/.cache/**"] },
      report: { outputPath: "report.html" },
    });

    expect(merged.scan.maxDepth).toBe(8);
    expect(merged.scan.excludePatterns).toEqual([...DEFAULT_SCAN_EXCLUDE_PATTERNS, "**/.cache/**"]);
    expect(merged.report).toMatchObject({ outputPath: "report.html", overwrite: true, open: false, format: "html" });
  });

  it("reports invalid config paths with actionable messages", async () => {
    const workspace = await createTempDirectory("bad-config-");
    await mkdir(join(workspace, ".git-snitch"), { recursive: true });
    await writeFile(join(workspace, ".git-snitch", "config.json"), JSON.stringify({ scan: { maxDepth: -1 } }));

    await expect(loadGitSnitchConfig(workspace)).rejects.toThrow(GitSnitchConfigError);
    await expect(loadGitSnitchConfig(workspace)).rejects.toThrow("scan.maxDepth");
  });
});

describe("public report generation API", () => {
  it("generates a JSON-safe repo report for the current branch by default", async () => {
    const repoPath = await createBranchingRepo("repo-report-");

    const report = await generateRepoReport(
      { repoPath, branches: [], allBranches: false, overwrite: true, open: false, format: "json" },
      { generatedAt },
    );

    expect(isRepoReportData(report)).toBe(true);
    expect(report.kind).toBe("repo");
    expect(report.generatedAt).toBe(generatedAt);
    expect(report.options.branches).toEqual(["main"]);
    expect(report.commits.map((commit) => commit.message)).toEqual(["feat: initial main commit"]);
    expect(report.repository).toMatchObject({ currentBranch: "main", totalCommits: 1, totalContributors: 1 });
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it("adds repo AI usage only when requested and filters by repo path and timeframe", async () => {
    const repoPath = await createBranchingRepo("repo-ai-usage-");
    const otherRepoPath = await createBranchingRepo("repo-ai-other-");
    const aiUsageRoot = await createTempDirectory("pi-usage-");
    await writePiUsage(aiUsageRoot, "matched", repoPath, [
      { id: "inside", timestamp: "2024-01-03T00:00:00.000Z", input: 10, output: 5 },
      { id: "outside-time", timestamp: "2024-02-03T00:00:00.000Z", input: 100, output: 50 },
    ]);
    await writePiUsage(aiUsageRoot, "other", otherRepoPath, [
      { id: "other", timestamp: "2024-01-03T00:00:00.000Z", input: 200, output: 100 },
    ]);

    const plainReport = await generateRepoReport(
      { repoPath, branches: [], allBranches: false, overwrite: true, open: false, format: "json" },
      { generatedAt, aiUsageStoreRoots: { pi: [aiUsageRoot] } },
    );
    const report = await generateRepoReport(
      {
        repoPath,
        branches: [],
        allBranches: false,
        overwrite: true,
        open: false,
        format: "json",
        aiUsage: true,
        since: "2024-01-01T00:00:00.000Z",
        until: "2024-01-31T23:59:59.000Z",
      },
      { generatedAt, aiUsageStoreRoots: { pi: [aiUsageRoot] } },
    );

    expect(plainReport.aiUsage).toBeUndefined();
    expect(report.aiUsage).toMatchObject({ records: 1, tokens: { total: 15 } });
    expect(JSON.stringify(report.aiUsage)).not.toContain(repoPath);
  }, 120_000);

  it("validates branch conflicts before report generation", async () => {
    const repoPath = await createBranchingRepo("branch-conflict-");

    await expect(
      generateRepoReport({ repoPath, branches: ["main"], allBranches: true, overwrite: true, open: false, format: "json" }),
    ).rejects.toThrow("explicit branches or allBranches");
  });

  it("generates scan reports using period parsing, maxDepth, default excludes, and user excludes", async () => {
    const workspace = await createTempDirectory("scan-report-");
    const service = join(workspace, "apps", "service");
    const excluded = join(workspace, "ignore-me", "repo");
    const noisy = join(workspace, "node_modules", "dependency");
    await mkdir(service, { recursive: true });
    await mkdir(excluded, { recursive: true });
    await mkdir(noisy, { recursive: true });
    await createCommittedRepoAt(service, "feat: service commit", "2024-01-15T10:00:00+00:00");
    await createCommittedRepoAt(excluded, "feat: excluded commit", "2024-01-16T10:00:00+00:00");
    await createCommittedRepoAt(noisy, "feat: noisy commit", "2024-01-17T10:00:00+00:00");

    const report = await generateScanReport(
      {
        directory: workspace,
        scan: { maxDepth: 3, includePatterns: ["**/.git"], excludePatterns: ["ignore-me"] },
        overwrite: true,
        open: false,
        format: "json",
        period: "30d",
        now: generatedAt,
      },
      { generatedAt },
    );

    expect(isScanReportData(report)).toBe(true);
    expect(report.kind).toBe("scan");
    expect(report.options.since).toBe("2024-01-02T00:00:00.000Z");
    expect(report.options.until).toBe(generatedAt);
    expect(report.projects.map((project) => project.repository.relativePath)).toEqual(["apps/service"]);
    expect(report.analysis).toMatchObject({ totalRepositories: 1, totalCommits: 1, totalContributors: 1 });
  });

  it("adds per-project and aggregate scan AI usage for matched projects only", async () => {
    const workspace = await createTempDirectory("scan-ai-usage-");
    const first = join(workspace, "first");
    const second = join(workspace, "second");
    const outside = await createTempDirectory("scan-ai-outside-");
    await mkdir(first, { recursive: true });
    await mkdir(second, { recursive: true });
    await createCommittedRepoAt(first, "feat: first commit", "2024-01-15T10:00:00+00:00");
    await createCommittedRepoAt(second, "feat: second commit", "2024-01-16T10:00:00+00:00");
    await createCommittedRepoAt(outside, "feat: outside commit", "2024-01-17T10:00:00+00:00");
    const aiUsageRoot = await createTempDirectory("scan-pi-usage-");
    await writePiUsage(aiUsageRoot, "first", first, [{ id: "first", timestamp: "2024-01-15T12:00:00.000Z", input: 10, output: 5 }]);
    await writePiUsage(aiUsageRoot, "second", second, [{ id: "second", timestamp: "2024-01-16T12:00:00.000Z", input: 20, output: 7 }]);
    await writePiUsage(aiUsageRoot, "outside", outside, [{ id: "outside", timestamp: "2024-01-16T12:00:00.000Z", input: 200, output: 100 }]);

    const report = await generateScanReport(
      {
        directory: workspace,
        scan: { maxDepth: 2, includePatterns: ["**/.git"], excludePatterns: [] },
        overwrite: true,
        open: false,
        format: "json",
        aiUsage: true,
        period: "30d",
        now: generatedAt,
      },
      { generatedAt, aiUsageStoreRoots: { pi: [aiUsageRoot] } },
    );

    const projectRecords = report.projects.reduce((sum, project) => sum + (project.report.aiUsage?.records ?? 0), 0);
    const projectTokens = report.projects.reduce((sum, project) => sum + (project.report.aiUsage?.tokens.total ?? 0), 0);
    expect(projectRecords).toBe(2);
    expect(projectTokens).toBe(42);
    expect(report.analysis.aiUsage).toMatchObject({ records: projectRecords, tokens: { total: projectTokens } });
    expect(report.analysis.aiUsage?.breakdowns.byClient).toEqual([expect.objectContaining({ key: "pi", records: projectRecords })]);
    expect(report.analysis.aiUsage?.breakdowns.byModel).toEqual([expect.objectContaining({ key: "claude-3-5-sonnet", records: projectRecords })]);
    expect(JSON.stringify(report.analysis.aiUsage)).not.toContain(outside);
  }, 120_000);

  it("rejects invalid scan periods with a clear validation error", () => {
    expect(() => parseScanPeriod({ period: "last-month", now: generatedAt })).toThrow(GitSnitchReportError);
    expect(() => parseScanPeriod({ period: "last-month", now: generatedAt })).toThrow("Use a positive duration such as 7d, 4w, 3m, or 1y");
  });
});

async function createBranchingRepo(prefix: string): Promise<string> {
  const repoPath = await createTempDirectory(prefix);
  await createCommittedRepoAt(repoPath, "feat: initial main commit", "2024-01-02T03:04:05+00:00");
  await git(repoPath, "checkout", "-b", "feature");
  await writeFile(join(repoPath, "feature.ts"), "export const feature = true;\n");
  await gitWithEnv(repoPath, ["add", "feature.ts"], "2024-01-03T03:04:05+00:00");
  await gitWithEnv(repoPath, ["commit", "-m", "fix: feature branch bug"], "2024-01-03T03:04:05+00:00");
  await git(repoPath, "checkout", "main");
  return repoPath;
}

async function createCommittedRepoAt(repoPath: string, message: string, date: string): Promise<void> {
  await git(repoPath, "init", "--initial-branch=main");
  await git(repoPath, "config", "user.name", "Ada Lovelace");
  await git(repoPath, "config", "user.email", "ada@example.test");
  await writeFile(join(repoPath, "index.ts"), `export const value = ${JSON.stringify(message)};\n`);
  await gitWithEnv(repoPath, ["add", "index.ts"], date);
  await gitWithEnv(repoPath, ["commit", "-m", message], date);
}

async function writePiUsage(
  root: string,
  sessionId: string,
  repoPath: string,
  messages: readonly { readonly id: string; readonly timestamp: string; readonly input: number; readonly output: number }[],
): Promise<void> {
  await mkdir(root, { recursive: true });
  const lines = [
    { type: "session", id: sessionId, cwd: repoPath, timestamp: messages[0]?.timestamp ?? "2024-01-01T00:00:00.000Z" },
    ...messages.map((message) => ({
      type: "message",
      id: message.id,
      timestamp: message.timestamp,
      message: {
        role: "assistant",
        model: "claude-3-5-sonnet",
        provider: "anthropic",
        usage: { input: message.input, output: message.output },
      },
    })),
  ];
  await writeFile(join(root, `${sessionId}.jsonl`), lines.map((line) => JSON.stringify(line)).join("\n"), "utf8");
}

async function createTempDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `git-snitch-${prefix}`));
}

async function git(cwd: string, ...args: readonly string[]): Promise<string> {
  return gitWithEnv(cwd, args, "2024-01-02T03:04:05+00:00");
}

async function gitWithEnv(cwd: string, args: readonly string[], date: string): Promise<string> {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Ada Lovelace",
      GIT_AUTHOR_EMAIL: "ada@example.test",
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_NAME: "Ada Lovelace",
      GIT_COMMITTER_EMAIL: "ada@example.test",
      GIT_COMMITTER_DATE: date,
    },
  });
  return result.stdout;
}
