import { relative } from "node:path";

import type { RepositoryAnalysis, ScanAnalysis } from "./analysis.js";
import type { CommitRecord } from "./commits.js";
import type { IsoDateString } from "./json.js";
import type { RepoReportOptions, ScanOptions, ScanPeriodOptions, ScanReportOptions } from "./options.js";
import type { RepoReportData, ScanProjectReport, ScanReportData } from "./report-data.js";
import type { RepositoryIdentity, RepositorySummary, ScannedRepositorySummary } from "./repos.js";
import type { AsyncCommandRunner, LineCountResult } from "./git/types.js";

import { calculateCodeQualityMetrics, generateHealthRecommendations } from "./quality-metrics.js";
import { classifyCommit } from "./commit-classifier.js";
import { aggregateContributors, generateContributorStats } from "./analysis.js";
import { findFileHotspots } from "./hotspots.js";
import { DEFAULT_SCAN_EXCLUDE_PATTERNS, repoReportOptionsSchema, scanReportOptionsSchema } from "./options.js";
import { discoverGitRepositories } from "./git/discovery.js";
import { getGitCommits } from "./git/log.js";
import { countLinesOfCode } from "./git/loc.js";
import { getCurrentBranch, getRepositoryInfo } from "./git/repository.js";
import { createGitCommandRunner } from "./git/runner.js";

export interface ReportGenerationDependencies {
  readonly runner?: AsyncCommandRunner;
  readonly generatedAt?: IsoDateString;
}

export interface GenerateScanReportOptions extends Omit<ScanReportOptions, "scan">, ScanPeriodOptions {
  readonly scan?: Partial<ScanOptions>;
}

export class GitSnitchReportError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GitSnitchReportError";
  }
}

/** Generates the JSON-safe public report data for a single repository. */
export async function generateRepoReport(
  options: RepoReportOptions,
  dependencies: ReportGenerationDependencies = {},
): Promise<RepoReportData> {
  const parsedOptions = parseRepoOptions(options);
  const runner = dependencies.runner ?? createGitCommandRunner();
  const branchOptions = await resolveBranchOptions(parsedOptions, runner);
  const commits = await getClassifiedCommits({ ...parsedOptions, ...branchOptions }, runner);
  const loc = await countLinesOfCode(parsedOptions.repoPath, { exclude: DEFAULT_SCAN_EXCLUDE_PATTERNS });
  const repositoryInfo = await getRepositoryInfo({ repoPath: parsedOptions.repoPath, runner });
  const contributors = generateContributorStats(commits);

  return {
    kind: "repo",
    generatedAt: dependencies.generatedAt ?? new Date().toISOString(),
    repository: summarizeRepository(repositoryInfo, commits, contributors.length),
    options: { ...parsedOptions, ...branchOptions },
    commits,
    contributors,
    analysis: analyzeRepository(commits, loc, contributors),
  };
}

/** Generates the JSON-safe public report data for a recursive repository scan. */
export async function generateScanReport(
  options: GenerateScanReportOptions,
  dependencies: ReportGenerationDependencies = {},
): Promise<ScanReportData> {
  const periodOptions = parseScanPeriod(options, dependencies.generatedAt);
  const parsedOptions = parseScanOptions({ ...options, ...periodOptions });
  const runner = dependencies.runner ?? createGitCommandRunner();
  const generatedAt = dependencies.generatedAt ?? new Date().toISOString();
  const discovered = await discoverGitRepositories(parsedOptions.directory, {
    maxDepth: parsedOptions.scan.maxDepth,
    exclude: parsedOptions.scan.excludePatterns,
  });

  const projects = await Promise.all(
    discovered.map(async (repository): Promise<ScanProjectReport> => {
      const report = await generateRepoReport(
        {
          ...repoOptionsFromScanOptions(parsedOptions, repository.path),
          allBranches: true,
        },
        { runner, generatedAt },
      );
      return {
        repository: summarizeScannedRepository(report.repository, repository.relativePath),
        report,
      };
    }),
  );

  return {
    kind: "scan",
    generatedAt,
    directory: parsedOptions.directory,
    options: parsedOptions,
    projects,
    analysis: analyzeScan(projects),
  };
}

export function parseScanPeriod(
  options: ScanPeriodOptions & Pick<ScanReportOptions, "since" | "until">,
  generatedAt?: IsoDateString,
): Pick<ScanReportOptions, "since" | "until"> {
  if (options.period === undefined) {
    return {};
  }
  if (options.since !== undefined || options.until !== undefined) {
    throw new GitSnitchReportError("Invalid scan period options. Use either period or explicit since/until dates, not both.");
  }

  const match = /^(\d+)(d|w|m|y)$/.exec(options.period.trim());
  if (!match) {
    throw new GitSnitchReportError("Invalid scan period. Use a positive duration such as 7d, 4w, 3m, or 1y.");
  }

  const amountText = match[1];
  const unit = match[2];
  if (amountText === undefined || !isPeriodUnit(unit)) {
    throw new GitSnitchReportError("Invalid scan period. Use a positive duration such as 7d, 4w, 3m, or 1y.");
  }

  const amount = Number.parseInt(amountText, 10);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new GitSnitchReportError("Invalid scan period. The duration amount must be a positive integer.");
  }

  const until = new Date(options.now ?? generatedAt ?? new Date().toISOString());
  if (Number.isNaN(until.getTime())) {
    throw new GitSnitchReportError("Invalid scan period reference time. Expected an ISO 8601 date string.");
  }
  const since = new Date(until.getTime() - amount * daysForUnit(unit) * 86_400_000);

  return { since: since.toISOString(), until: until.toISOString() };
}

type PeriodUnit = "d" | "w" | "m" | "y";

function isPeriodUnit(value: string | undefined): value is PeriodUnit {
  return value === "d" || value === "w" || value === "m" || value === "y";
}

function daysForUnit(unit: PeriodUnit): number {
  switch (unit) {
    case "d":
      return 1;
    case "w":
      return 7;
    case "m":
      return 30;
    case "y":
      return 365;
  }
}

function parseRepoOptions(options: RepoReportOptions): RepoReportOptions {
  const parsed = repoReportOptionsSchema.safeParse(options);
  if (!parsed.success) {
    throw new GitSnitchReportError(`Invalid repo report options: ${formatIssues(parsed.error.issues)}`);
  }
  return parsed.data;
}

function parseScanOptions(options: GenerateScanReportOptions): ScanReportOptions {
  const scanInput = {
    ...options.scan,
    excludePatterns: [...new Set([...DEFAULT_SCAN_EXCLUDE_PATTERNS, ...(options.scan?.excludePatterns ?? [])])],
  };
  const parsed = scanReportOptionsSchema.safeParse({
    ...options,
    scan: scanInput,
  });
  if (!parsed.success) {
    throw new GitSnitchReportError(`Invalid scan report options: ${formatIssues(parsed.error.issues)}`);
  }
  return parsed.data;
}

async function resolveBranchOptions(
  options: RepoReportOptions,
  runner: AsyncCommandRunner,
): Promise<Pick<RepoReportOptions, "branches" | "allBranches">> {
  if (options.allBranches && options.branches.length > 0) {
    throw new GitSnitchReportError("Invalid branch options: use either explicit branches or allBranches, not both.");
  }
  if (options.allBranches || options.branches.length > 0) {
    return { branches: options.branches, allBranches: options.allBranches };
  }

  const currentBranch = await getCurrentBranch({ repoPath: options.repoPath, runner });
  return { branches: currentBranch ? [currentBranch] : [], allBranches: false };
}

async function getClassifiedCommits(options: RepoReportOptions, runner: AsyncCommandRunner): Promise<readonly CommitRecord[]> {
  const commits = await getGitCommits({
    repoPath: options.repoPath,
    runner,
    since: options.since,
    until: options.until,
    branches: options.branches,
    allBranches: options.allBranches,
  });

  return commits.map((commit) => ({ ...commit, classification: classifyCommit(commit.message) }));
}

function summarizeRepository(
  identity: RepositoryIdentity,
  commits: readonly CommitRecord[],
  totalContributors: number,
): RepositorySummary {
  const sorted = [...commits].sort((left, right) => new Date(left.authoredAt).getTime() - new Date(right.authoredAt).getTime());
  const first = sorted.at(0);
  const last = sorted.at(-1);
  return {
    ...identity,
    ...(first ? { firstCommitAt: first.authoredAt } : {}),
    ...(last ? { lastCommitAt: last.authoredAt } : {}),
    totalCommits: commits.length,
    totalContributors,
  };
}

function summarizeScannedRepository(repository: RepositorySummary, relativePath: string): ScannedRepositorySummary {
  return {
    ...repository,
    id: slugFromRelativePath(relativePath),
    relativePath,
  };
}

function analyzeRepository(
  commits: readonly CommitRecord[],
  loc: LineCountResult,
  contributors: ReturnType<typeof generateContributorStats>,
): RepositoryAnalysis {
  const metrics = calculateCodeQualityMetrics(commits, loc, contributors);
  const recommendations = generateHealthRecommendations(metrics, commits);
  return {
    languages: loc.byLanguage.map((language) => ({ language: language.language, files: language.files, lines: language.source })),
    hotspots: findFileHotspots(commits),
    cadence: buildMonthlyCadence(commits),
    qualitySignals: recommendations.map((recommendation, index) => ({
      id: `${recommendation.category.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${index + 1}`,
      label: recommendation.category,
      severity: recommendation.severity === "high" ? "critical" : recommendation.severity === "medium" ? "warning" : "info",
      value: metrics.healthScore,
      summary: recommendation.message,
    })),
  };
}

function analyzeScan(projects: readonly ScanProjectReport[]): ScanAnalysis {
  const contributors = aggregateContributors(projects);
  const languageTotals = new Map<string, { files: number; lines: number }>();
  const qualitySignals = projects.flatMap((project) => project.report.analysis.qualitySignals);

  for (const project of projects) {
    for (const language of project.report.analysis.languages) {
      const existing = languageTotals.get(language.language) ?? { files: 0, lines: 0 };
      existing.files += language.files;
      existing.lines += language.lines;
      languageTotals.set(language.language, existing);
    }
  }

  return {
    totalCommits: projects.reduce((sum, project) => sum + project.report.repository.totalCommits, 0),
    totalContributors: contributors.length,
    totalRepositories: projects.length,
    languages: [...languageTotals.entries()]
      .map(([language, totals]) => ({ language, files: totals.files, lines: totals.lines }))
      .sort((left, right) => right.lines - left.lines || left.language.localeCompare(right.language)),
    qualitySignals,
  };
}

function buildMonthlyCadence(commits: readonly CommitRecord[]) {
  const counts = new Map<string, number>();
  for (const commit of commits) {
    const period = commit.authoredAt.slice(0, 7);
    counts.set(period, (counts.get(period) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([period, count]) => ({ period, commits: count }));
}

function repoOptionsFromScanOptions(options: ScanReportOptions, repoPath: string): RepoReportOptions {
  return {
    outputPath: options.outputPath,
    overwrite: options.overwrite,
    open: options.open,
    format: options.format,
    since: options.since,
    until: options.until,
    templatePath: options.templatePath,
    repoPath,
    branches: [],
    allBranches: false,
  };
}

function slugFromRelativePath(path: string): string {
  if (path === ".") {
    return "root";
  }
  return relative(".", path).replaceAll("\\", "/").replaceAll(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "repo";
}

function formatIssues(issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]): string {
  return issues.map((issue) => `${issue.path.map(String).join(".") || "options"}: ${issue.message}`).join("; ");
}
