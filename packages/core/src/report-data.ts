import { z } from "zod";

import type { ReportAnonymizationMeta } from "./anonymize.js";
import type { RepositoryAnalysis, ScanAnalysis } from "./analysis.js";
import type { CommitRecord } from "./commits.js";
import type { ContributorSummary } from "./contributors.js";
import type { IsoDateString } from "./json.js";
import type { RepoReportOptions, ScanReportOptions } from "./options.js";
import type { RepositorySummary, ScannedRepositorySummary } from "./repos.js";
import type { AiTokenBreakdown, AiUsageBreakdownItem, AiUsageBreakdowns, ReportAiUsageProjectSummary } from "./ai-usage/index.js";
import { isoDateStringSchema } from "./options.js";

export interface RepoReportData {
  readonly kind: "repo";
  readonly generatedAt: IsoDateString;
  readonly repository: RepositorySummary;
  readonly options: RepoReportOptions;
  readonly commits: readonly CommitRecord[];
  readonly contributors: readonly ContributorSummary[];
  readonly analysis: RepositoryAnalysis;
  readonly aiUsage?: ReportAiUsageProjectSummary;
  readonly anonymization?: ReportAnonymizationMeta;
}

export interface ScanProjectReport {
  readonly repository: ScannedRepositorySummary;
  readonly report: RepoReportData;
}

export interface ScanReportData {
  readonly kind: "scan";
  readonly generatedAt: IsoDateString;
  readonly directory: string;
  readonly options: ScanReportOptions;
  readonly projects: readonly ScanProjectReport[];
  readonly analysis: ScanAnalysis;
  readonly anonymization?: ReportAnonymizationMeta;
}

export type ReportData = RepoReportData | ScanReportData;

export const reportKindSchema = z.enum(["repo", "scan"]);

const reportAnonymizationMetaSchema: z.ZodType<ReportAnonymizationMeta> = z.object({
  applied: z.boolean(),
  flags: z.array(z.string()),
  salt: z.string(),
});

export const reportDataDiscriminantSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("repo"), generatedAt: isoDateStringSchema }),
  z.object({ kind: z.literal("scan"), generatedAt: isoDateStringSchema }),
]);

const reportOptionsShape = {
  outputPath: z.string().min(1).optional(),
  overwrite: z.boolean(),
  open: z.boolean(),
  format: z.enum(["html", "json"]),
  since: isoDateStringSchema.optional(),
  until: isoDateStringSchema.optional(),
  templatePath: z.string().min(1).optional(),
  aiUsage: z.boolean().optional(),
};

const aiTokenBreakdownSchema: z.ZodType<AiTokenBreakdown> = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  cacheRead: z.number().int().nonnegative(),
  cacheWrite: z.number().int().nonnegative(),
  reasoning: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const aiUsageSummaryShape = {
  records: z.number().int().nonnegative(),
  tokens: aiTokenBreakdownSchema,
  cost: z.number().nonnegative(),
  unsubsidizedCost: z.number().nonnegative().optional(),
};

const aiUsageBreakdownItemSchema: z.ZodType<AiUsageBreakdownItem> = z.object({
  key: z.string(),
  ...aiUsageSummaryShape,
});

const aiUsageBreakdownsSchema: z.ZodType<AiUsageBreakdowns> = z.object({
  byClient: z.array(aiUsageBreakdownItemSchema),
  byModel: z.array(aiUsageBreakdownItemSchema),
  byDay: z.array(aiUsageBreakdownItemSchema),
});

const reportAiUsageProjectSummarySchema: z.ZodType<ReportAiUsageProjectSummary> = z.object({
  ...aiUsageSummaryShape,
  breakdowns: aiUsageBreakdownsSchema,
});

const repositorySummaryShape = {
  name: z.string(),
  path: z.string(),
  rootPath: z.string(),
  currentBranch: z.string().optional(),
  remoteUrl: z.string().optional(),
  firstCommitAt: isoDateStringSchema.optional(),
  lastCommitAt: isoDateStringSchema.optional(),
  totalCommits: z.number().int().nonnegative(),
  totalContributors: z.number().int().nonnegative(),
  github: z.object({
    description: z.string().optional(),
    stars: z.number().optional(),
    forks: z.number().optional(),
    license: z.string().optional(),
    topics: z.array(z.string()).optional(),
    visibility: z.enum(["public", "private"]).optional(),
    homepageUrl: z.string().optional(),
    openIssues: z.number().optional(),
    openPullRequests: z.number().optional(),
  }).optional(),
};

const repositorySummarySchema: z.ZodType<RepositorySummary> = z.object(repositorySummaryShape);

const scannedRepositorySummarySchema: z.ZodType<ScannedRepositorySummary> = z.object({
  ...repositorySummaryShape,
  id: z.string(),
  relativePath: z.string(),
});

const repoReportOptionsSchema: z.ZodType<RepoReportOptions> = z.object({
  ...reportOptionsShape,
  repoPath: z.string().min(1),
  branches: z.array(z.string().min(1)),
  allBranches: z.boolean(),
});

const scanOptionsSchema = z.object({
  maxDepth: z.number().int().nonnegative(),
  includePatterns: z.array(z.string().min(1)),
  excludePatterns: z.array(z.string().min(1)),
});

const scanReportOptionsSchema: z.ZodType<ScanReportOptions> = z.object({
  ...reportOptionsShape,
  directory: z.string().min(1),
  scan: scanOptionsSchema,
});

const commitAuthorSchema = z.object({
  name: z.string(),
  email: z.string(),
});

const commitFileChangeSchema = z.object({
  path: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  status: z.enum(["added", "modified", "deleted", "renamed", "copied", "unknown"]),
  previousPath: z.string().optional(),
});

const commitRecordSchema: z.ZodType<CommitRecord> = z.object({
  hash: z.string(),
  shortHash: z.string(),
  message: z.string(),
  body: z.string().optional(),
  author: commitAuthorSchema,
  authoredAt: isoDateStringSchema,
  committedAt: isoDateStringSchema,
  parents: z.array(z.string()),
  refs: z.array(z.string()),
  classification: z.enum([
    "feature",
    "fix",
    "bugfix",
    "docs",
    "refactor",
    "test",
    "chore",
    "style",
    "perf",
    "ci",
    "build",
    "revert",
    "merge",
    "release",
    "other",
  ]),
  files: z.array(commitFileChangeSchema),
});

const contributorSummarySchema: z.ZodType<ContributorSummary> = z.object({
  name: z.string(),
  email: z.string(),
  commitCount: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  filesChanged: z.number().int().nonnegative(),
  firstCommitAt: isoDateStringSchema.optional(),
  lastCommitAt: isoDateStringSchema.optional(),
});

const languageStatSchema = z.object({
  language: z.string(),
  files: z.number().int().nonnegative(),
  lines: z.number().int().nonnegative(),
});

const qualitySignalSchema = z.object({
  id: z.string(),
  label: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  value: z.number(),
  summary: z.string(),
});

const repositoryAnalysisSchema: z.ZodType<RepositoryAnalysis> = z.object({
  languages: z.array(languageStatSchema),
  hotspots: z.array(
    z.object({
      path: z.string(),
      changeCount: z.number().int().nonnegative(),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
      contributorCount: z.number().int().nonnegative(),
      contributors: z.array(z.string()),
      churn: z.number().int().nonnegative(),
      lastChangedAt: isoDateStringSchema,
      hotspotScore: z.number().int().nonnegative(),
      riskLevel: z.object({
        level: z.enum(["low", "medium", "high"]),
        color: z.string(),
        emoji: z.string(),
      }),
    }),
  ),
  cadence: z.array(
    z.object({
      period: z.string(),
      commits: z.number().int().nonnegative(),
    }),
  ),
  qualitySignals: z.array(qualitySignalSchema),
});

const scanAnalysisSchema: z.ZodType<ScanAnalysis> = z.object({
  totalCommits: z.number().int().nonnegative(),
  totalContributors: z.number().int().nonnegative(),
  totalRepositories: z.number().int().nonnegative(),
  languages: z.array(languageStatSchema),
  qualitySignals: z.array(qualitySignalSchema),
  aiUsage: reportAiUsageProjectSummarySchema.optional(),
});

export const repoReportDataSchema: z.ZodType<RepoReportData> = z.object({
  kind: z.literal("repo"),
  generatedAt: isoDateStringSchema,
  repository: repositorySummarySchema,
  options: repoReportOptionsSchema,
  commits: z.array(commitRecordSchema),
  contributors: z.array(contributorSummarySchema),
  analysis: repositoryAnalysisSchema,
  aiUsage: reportAiUsageProjectSummarySchema.optional(),
  anonymization: reportAnonymizationMetaSchema.optional(),
});

const scanProjectReportSchema: z.ZodType<ScanProjectReport> = z.object({
  repository: scannedRepositorySummarySchema,
  report: repoReportDataSchema,
});

export const scanReportDataSchema: z.ZodType<ScanReportData> = z.object({
  kind: z.literal("scan"),
  generatedAt: isoDateStringSchema,
  directory: z.string(),
  options: scanReportOptionsSchema,
  projects: z.array(scanProjectReportSchema),
  analysis: scanAnalysisSchema,
  anonymization: reportAnonymizationMetaSchema.optional(),
});

export function isRepoReportData(report: unknown): report is RepoReportData {
  return repoReportDataSchema.safeParse(report).success;
}

export function isScanReportData(report: unknown): report is ScanReportData {
  return scanReportDataSchema.safeParse(report).success;
}
