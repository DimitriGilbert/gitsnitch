import { randomBytes } from "node:crypto";

import type { FileHotspot, RepositoryAnalysis } from "./analysis.js";
import type { CommitFileChange, CommitRecord } from "./commits.js";
import type { ContributorSummary } from "./contributors.js";
import type { RepoReportData, ReportData, ScanProjectReport, ScanReportData } from "./report-data.js";
import type { RepoReportOptions, ScanReportOptions } from "./options.js";
import type { RepositorySummary, ScannedRepositorySummary } from "./repos.js";

// ---------- Public types ----------

export interface AnonymizationOptions {
  readonly hideNames?: boolean;
  readonly hideEmails?: boolean;
  readonly hidePaths?: boolean;
  readonly hideUrls?: boolean;
  readonly hashCommits?: boolean;
  readonly hideMessages?: boolean;
  readonly obfuscateKey?: string;
}

export interface ReportAnonymizationMeta {
  readonly applied: boolean;
  readonly flags: readonly string[];
  readonly salt: string;
}

// ---------- FNV-1a hash (32-bit) ----------

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

function fnv1a(data: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < data.length; i += 1) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function fnv1aHex(salt: string, value: string): string {
  return fnv1a(salt + "\x00" + value).toString(16).padStart(8, "0");
}

// ---------- Obfuscation helpers ----------

function hashFilePath(salt: string, filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot >= 0 ? filePath.slice(lastDot) : "";
  return `f-${fnv1aHex(salt, filePath).slice(0, 4)}${ext}`;
}

function obfuscateCommitHash(salt: string, original: string): string {
  const h1 = fnv1aHex(salt, "c:" + original);
  const h2 = fnv1aHex(salt + "\x01", "c:" + original);
  const h3 = fnv1aHex(salt + "\x02", "c:" + original);
  const h4 = fnv1aHex(salt + "\x03", "c:" + original);
  const h5 = fnv1aHex(salt + "\x04", "c:" + original);
  return h1 + h2 + h3 + h4 + h5;
}

function lastPathSegment(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");
  return segments.at(-1) ?? ".";
}

// ---------- Identity pseudonym mapper ----------

interface IdentityMapping {
  readonly name: string;
  readonly email: string;
}

function createIdentityMapper(): (email: string) => IdentityMapping {
  const emailToIndex = new Map<string, number>();
  let nextIndex = 0;

  return (email: string): IdentityMapping => {
    const existing = emailToIndex.get(email);
    if (existing !== undefined) {
      return { name: `user-${existing}`, email: `user-${existing}@anon` };
    }
    nextIndex += 1;
    emailToIndex.set(email, nextIndex);
    return { name: `user-${nextIndex}`, email: `user-${nextIndex}@anon` };
  };
}

// ---------- Anonymization context ----------

interface AnonymizationContext {
  readonly salt: string;
  readonly options: AnonymizationOptions;
  readonly mapIdentity: (email: string) => IdentityMapping;
}

function createAnonymizationContext(options: AnonymizationOptions): AnonymizationContext {
  const salt = options.obfuscateKey ?? randomBytes(16).toString("hex");
  return { salt, options, mapIdentity: createIdentityMapper() };
}

function collectFlags(options: AnonymizationOptions): readonly string[] {
  const flags: string[] = [];
  if (options.hideNames) flags.push("hideNames");
  if (options.hideEmails) flags.push("hideEmails");
  if (options.hidePaths) flags.push("hidePaths");
  if (options.hideUrls) flags.push("hideUrls");
  if (options.hashCommits) flags.push("hashCommits");
  if (options.hideMessages) flags.push("hideMessages");
  return flags;
}

// ---------- Main entry point ----------

export function anonymizeReport(
  report: ReportData,
  options: AnonymizationOptions = {},
): { readonly report: ReportData; readonly meta: ReportAnonymizationMeta } {
  const ctx = createAnonymizationContext(options);
  const flags = collectFlags(options);

  const anonymized: ReportData =
    report.kind === "repo"
      ? anonymizeRepoReport(report, ctx)
      : anonymizeScanReport(report, ctx);

  const metaSalt =
    options.obfuscateKey !== undefined
      ? fnv1aHex("meta", ctx.salt)
      : ctx.salt;

  return {
    report: anonymized,
    meta: { applied: flags.length > 0, flags, salt: metaSalt },
  };
}

// ---------- RepoReportData ----------

function anonymizeRepoReport(report: RepoReportData, ctx: AnonymizationContext): RepoReportData {
  return {
    kind: report.kind,
    generatedAt: report.generatedAt,
    repository: anonymizeRepositorySummary(report.repository, ctx),
    options: anonymizeRepoOptions(report.options, ctx),
    commits: report.commits.map((commit) => anonymizeCommit(commit, ctx)),
    contributors: report.contributors.map((c) => anonymizeContributor(c, ctx)),
    analysis: anonymizeRepositoryAnalysis(report.analysis, ctx),
    ...(report.aiUsage === undefined ? {} : { aiUsage: report.aiUsage }),
  };
}

// ---------- ScanReportData ----------

function anonymizeScanReport(report: ScanReportData, ctx: AnonymizationContext): ScanReportData {
  return {
    kind: report.kind,
    generatedAt: report.generatedAt,
    directory: ctx.options.hidePaths ? "." : report.directory,
    options: anonymizeScanOptions(report.options, ctx),
    projects: report.projects.map((p) => anonymizeScanProject(p, ctx)),
    analysis: report.analysis,
  };
}

// ---------- RepositorySummary ----------

function anonymizeRepositorySummary(repo: RepositorySummary, ctx: AnonymizationContext): RepositorySummary {
  return {
    name: `project-${fnv1aHex(ctx.salt, repo.name).slice(0, 6)}`,
    path: ctx.options.hidePaths ? "." : repo.path,
    rootPath: ctx.options.hidePaths ? "." : repo.rootPath,
    currentBranch: repo.currentBranch,
    remoteUrl: ctx.options.hideUrls ? undefined : repo.remoteUrl,
    firstCommitAt: repo.firstCommitAt,
    lastCommitAt: repo.lastCommitAt,
    totalCommits: repo.totalCommits,
    totalContributors: repo.totalContributors,
    github: ctx.options.hideUrls ? undefined : repo.github,
  };
}

// ---------- ScannedRepositorySummary ----------

function anonymizeScannedRepositorySummary(
  repo: ScannedRepositorySummary,
  ctx: AnonymizationContext,
): ScannedRepositorySummary {
  return {
    ...anonymizeRepositorySummary(repo, ctx),
    id: `project-${fnv1aHex(ctx.salt, repo.id).slice(0, 6)}`,
    relativePath: lastPathSegment(repo.relativePath),
  };
}

// ---------- RepoReportOptions ----------

function anonymizeRepoOptions(options: RepoReportOptions, ctx: AnonymizationContext): RepoReportOptions {
  return {
    ...options,
    repoPath: ctx.options.hidePaths ? "." : options.repoPath,
  };
}

// ---------- ScanReportOptions ----------

function anonymizeScanOptions(options: ScanReportOptions, ctx: AnonymizationContext): ScanReportOptions {
  return {
    ...options,
    directory: ctx.options.hidePaths ? "." : options.directory,
  };
}

// ---------- CommitRecord ----------

function anonymizeCommit(commit: CommitRecord, ctx: AnonymizationContext): CommitRecord {
  const mapping = ctx.mapIdentity(commit.author.email);

  let hash = commit.hash;
  let shortHash = commit.shortHash;
  let parents: readonly string[] = commit.parents;
  if (ctx.options.hashCommits) {
    hash = obfuscateCommitHash(ctx.salt, commit.hash);
    shortHash = hash.slice(0, 7);
    parents = commit.parents.map((p) => obfuscateCommitHash(ctx.salt, p));
  }

  let message = commit.message;
  let body = commit.body;
  if (ctx.options.hideMessages) {
    message = `[${commit.classification}]`;
    body = undefined;
  }

  return {
    hash,
    shortHash,
    message,
    body,
    author: {
      name: ctx.options.hideNames ? mapping.name : commit.author.name,
      email: ctx.options.hideEmails ? mapping.email : commit.author.email,
    },
    authoredAt: commit.authoredAt,
    committedAt: commit.committedAt,
    parents,
    refs: commit.refs,
    classification: commit.classification,
    files: commit.files.map((f) => anonymizeFileChange(f, ctx)),
  };
}

// ---------- CommitFileChange ----------

function anonymizeFileChange(file: CommitFileChange, ctx: AnonymizationContext): CommitFileChange {
  return {
    ...file,
    path: ctx.options.hidePaths ? hashFilePath(ctx.salt, file.path) : file.path,
    previousPath:
      file.previousPath !== undefined && ctx.options.hidePaths
        ? hashFilePath(ctx.salt, file.previousPath)
        : file.previousPath,
  };
}

// ---------- ContributorSummary ----------

function anonymizeContributor(contributor: ContributorSummary, ctx: AnonymizationContext): ContributorSummary {
  const mapping = ctx.mapIdentity(contributor.email);
  return {
    ...contributor,
    name: ctx.options.hideNames ? mapping.name : contributor.name,
    email: ctx.options.hideEmails ? mapping.email : contributor.email,
  };
}

// ---------- RepositoryAnalysis ----------

function anonymizeRepositoryAnalysis(analysis: RepositoryAnalysis, ctx: AnonymizationContext): RepositoryAnalysis {
  return {
    ...analysis,
    hotspots: analysis.hotspots.map((h) => anonymizeHotspot(h, ctx)),
  };
}

// ---------- FileHotspot ----------

function anonymizeHotspot(hotspot: FileHotspot, ctx: AnonymizationContext): FileHotspot {
  return {
    ...hotspot,
    path: ctx.options.hidePaths ? hashFilePath(ctx.salt, hotspot.path) : hotspot.path,
    contributors: ctx.options.hideEmails
      ? hotspot.contributors.map((email) => ctx.mapIdentity(email).email)
      : hotspot.contributors,
  };
}

// ---------- ScanProjectReport ----------

function anonymizeScanProject(project: ScanProjectReport, ctx: AnonymizationContext): ScanProjectReport {
  return {
    repository: anonymizeScannedRepositorySummary(project.repository, ctx),
    report: anonymizeRepoReport(project.report, ctx),
  };
}
