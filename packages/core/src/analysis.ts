import type { CommitRecord } from "./commits";
import type { ContributorSummary } from "./contributors";
import type { IsoDateString } from "./json";

export interface LanguageStat {
  readonly language: string;
  readonly files: number;
  readonly lines: number;
}

export interface TimingStats {
  readonly avgHours: number;
  readonly avgDays: number;
}

export interface ProjectStats {
  readonly totalCommits: number;
  readonly totalContributors: number;
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly avgAdditions: number;
  readonly avgDeletions: number;
  readonly avgTimeBetweenCommits: TimingStats;
}

export type CommitSortKey = "date" | "additions" | "deletions";

export type SortOrder = "asc" | "desc";

export type DateBoundary = IsoDateString | Date;

export interface ContributorAggregateProject {
  readonly report: {
    readonly contributors: readonly ContributorSummary[];
  };
}

export interface FileHotspot {
  readonly path: string;
  readonly changeCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly contributorCount: number;
  readonly contributors: readonly string[];
  readonly churn: number;
  readonly lastChangedAt: IsoDateString;
  readonly hotspotScore: number;
  readonly riskLevel: FileRiskLevel;
}

export type FileRiskLevelName = "low" | "medium" | "high";

export interface FileRiskLevel {
  readonly level: FileRiskLevelName;
  readonly color: string;
  readonly emoji: string;
}

export interface PeakHourInsight {
  readonly hour: number;
  readonly hourFormatted: string;
  readonly commits: number;
  readonly percentage: number;
}

export interface PeakDayInsight {
  readonly day: number;
  readonly dayName: string;
  readonly commits: number;
  readonly percentage: number;
}

export type VelocityLevel = "unknown" | "low" | "medium" | "high";

export interface VelocityInsight {
  readonly linesPerDay: number;
  readonly commitsPerDay: number;
  readonly velocity: VelocityLevel;
  readonly totalLines: number;
}

export type DevelopmentConsistency = "unknown" | "irregular" | "somewhat-consistent" | "consistent" | "highly-consistent";

export interface DevelopmentRhythmInsight {
  readonly consistency: DevelopmentConsistency;
  readonly avgDaysBetweenCommits: number;
  readonly rhythmScore: number;
  readonly standardDeviation: number;
}

export type CollaborationLevel = "none" | "low" | "medium" | "high";

export interface CollaborationInsight {
  readonly score: number;
  readonly multiAuthorFiles: number;
  readonly totalFiles: number;
  readonly collaborationLevel: CollaborationLevel;
}

export type WorkLifeBalance = "unknown" | "good" | "fair" | "poor";

export interface FocusTimeInsight {
  readonly workingHoursCommits: number;
  readonly workingHoursPercent: number;
  readonly afterHoursCommits: number;
  readonly afterHoursPercent: number;
  readonly weekendCommits: number;
  readonly weekendPercent: number;
  readonly workLifeBalance: WorkLifeBalance;
}

export interface ProductivityInsights {
  readonly contributorCount: number;
  readonly peakHours: PeakHourInsight;
  readonly peakDays: PeakDayInsight;
  readonly velocity: VelocityInsight;
  readonly rhythm: DevelopmentRhythmInsight;
  readonly collaboration: CollaborationInsight;
  readonly focusTime: FocusTimeInsight;
}

export interface CommitCadencePoint {
  readonly period: string;
  readonly commits: number;
}

export interface QualitySignal {
  readonly id: string;
  readonly label: string;
  readonly severity: "info" | "warning" | "critical";
  readonly value: number;
  readonly summary: string;
}

export type HealthRecommendationSeverity = "low" | "medium" | "high";

export interface HealthScoreRating {
  readonly label: "Excellent" | "Good" | "Fair" | "Poor" | "Critical";
  readonly color: string;
  readonly emoji: string;
}

export interface HealthRecommendation {
  readonly severity: HealthRecommendationSeverity;
  readonly category: string;
  readonly message: string;
  readonly action: string;
}

export interface CodeQualityMetricsWithoutHealthScore {
  readonly churnRate: number;
  readonly busFactor: number;
  readonly ownershipConcentration: number;
  readonly avgCommitSize: number;
  readonly codeStability: number;
  readonly commentRatio: number;
}

export interface CodeQualityMetrics extends CodeQualityMetricsWithoutHealthScore {
  readonly healthScore: number;
}

export interface RepositoryAnalysis {
  readonly languages: readonly LanguageStat[];
  readonly hotspots: readonly FileHotspot[];
  readonly cadence: readonly CommitCadencePoint[];
  readonly qualitySignals: readonly QualitySignal[];
}

export interface ScanAnalysis {
  readonly totalCommits: number;
  readonly totalContributors: number;
  readonly totalRepositories: number;
  readonly languages: readonly LanguageStat[];
  readonly qualitySignals: readonly QualitySignal[];
}

export function calculateProjectStats(commits: readonly CommitRecord[]): ProjectStats {
  const totalCommits = commits.length;
  const totalAdditions = commits.reduce((sum, commit) => sum + calculateCommitAdditions(commit), 0);
  const totalDeletions = commits.reduce((sum, commit) => sum + calculateCommitDeletions(commit), 0);

  return {
    totalCommits,
    totalContributors: new Set(commits.map((commit) => contributorKey(commit.author.email))).size,
    totalAdditions,
    totalDeletions,
    avgAdditions: totalCommits > 0 ? Math.round(totalAdditions / totalCommits) : 0,
    avgDeletions: totalCommits > 0 ? Math.round(totalDeletions / totalCommits) : 0,
    avgTimeBetweenCommits: calculateTimingStats(commits),
  };
}

export function sortCommits(
  commits: readonly CommitRecord[],
  sortBy: CommitSortKey = "date",
  order: SortOrder = "desc",
): readonly CommitRecord[] {
  const direction = order === "asc" ? 1 : -1;
  return [...commits].sort((left, right) => direction * (commitSortValue(left, sortBy) - commitSortValue(right, sortBy)));
}

export function filterCommitsByDate(
  commits: readonly CommitRecord[],
  startDate?: DateBoundary,
  endDate?: DateBoundary,
): readonly CommitRecord[] {
  const startTime = startDate === undefined ? undefined : normalizeDateBoundary(startDate).getTime();
  const endTime = endDate === undefined ? undefined : normalizeDateBoundary(endDate).getTime();

  return commits.filter((commit) => {
    const authoredTime = new Date(commit.authoredAt).getTime();
    return (startTime === undefined || authoredTime >= startTime) && (endTime === undefined || authoredTime <= endTime);
  });
}

export function generateContributorStats(commits: readonly CommitRecord[]): readonly ContributorSummary[] {
  const contributors = new Map<string, ContributorSummary>();

  for (const commit of commits) {
    const key = contributorIdentityKey(commit.author.name, commit.author.email);
    const existing = contributors.get(key);
    const additions = calculateCommitAdditions(commit);
    const deletions = calculateCommitDeletions(commit);
    const changedPaths = new Set(commit.files.map((file) => file.path));
    const next: ContributorSummary = {
      name: existing?.name ?? commit.author.name,
      email: existing?.email ?? commit.author.email,
      commitCount: (existing?.commitCount ?? 0) + 1,
      additions: (existing?.additions ?? 0) + additions,
      deletions: (existing?.deletions ?? 0) + deletions,
      filesChanged: (existing?.filesChanged ?? 0) + changedPaths.size,
      firstCommitAt: earliestIsoDate(existing?.firstCommitAt, commit.authoredAt),
      lastCommitAt: latestIsoDate(existing?.lastCommitAt, commit.authoredAt),
    };
    contributors.set(key, next);
  }

  return [...contributors.values()].sort(compareContributors);
}

export function aggregateContributors(projects: readonly ContributorAggregateProject[]): readonly ContributorSummary[] {
  const contributors = new Map<string, ContributorSummary>();

  for (const project of projects) {
    for (const contributor of project.report.contributors) {
      const key = contributorKey(contributor.email);
      const existing = contributors.get(key);
      const next: ContributorSummary = {
        name: existing?.name ?? contributor.name,
        email: existing?.email ?? contributor.email,
        commitCount: (existing?.commitCount ?? 0) + contributor.commitCount,
        additions: (existing?.additions ?? 0) + contributor.additions,
        deletions: (existing?.deletions ?? 0) + contributor.deletions,
        filesChanged: (existing?.filesChanged ?? 0) + contributor.filesChanged,
        firstCommitAt: earliestIsoDate(existing?.firstCommitAt, contributor.firstCommitAt),
        lastCommitAt: latestIsoDate(existing?.lastCommitAt, contributor.lastCommitAt),
      };
      contributors.set(key, next);
    }
  }

  return [...contributors.values()].sort(compareContributors);
}

export function calculateTimingStats(commits: readonly CommitRecord[]): TimingStats {
  if (commits.length < 2) {
    return { avgHours: 0, avgDays: 0 };
  }

  const sortedTimes = commits.map((commit) => new Date(commit.authoredAt).getTime()).sort((left, right) => left - right);
  let totalMilliseconds = 0;
  for (let index = 1; index < sortedTimes.length; index += 1) {
    const current = sortedTimes[index];
    const previous = sortedTimes[index - 1];
    if (current !== undefined && previous !== undefined) {
      totalMilliseconds += current - previous;
    }
  }
  const avgMilliseconds = totalMilliseconds / (sortedTimes.length - 1);
  const avgHours = Math.round(avgMilliseconds / 3_600_000);

  return {
    avgHours,
    avgDays: Math.round((avgHours / 24) * 10) / 10,
  };
}

function calculateCommitAdditions(commit: CommitRecord): number {
  return commit.files.reduce((sum, file) => sum + file.additions, 0);
}

function calculateCommitDeletions(commit: CommitRecord): number {
  return commit.files.reduce((sum, file) => sum + file.deletions, 0);
}

function commitSortValue(commit: CommitRecord, sortBy: CommitSortKey): number {
  switch (sortBy) {
    case "additions":
      return calculateCommitAdditions(commit);
    case "deletions":
      return calculateCommitDeletions(commit);
    case "date":
      return new Date(commit.authoredAt).getTime();
  }
}

function normalizeDateBoundary(boundary: DateBoundary): Date {
  return boundary instanceof Date ? boundary : new Date(boundary);
}

function contributorIdentityKey(name: string, email: string): string {
  return `${name.trim()}\u0000${contributorKey(email)}`;
}

function contributorKey(email: string): string {
  return email.trim().toLowerCase();
}

function earliestIsoDate(left: IsoDateString | undefined, right: IsoDateString | undefined): IsoDateString | undefined {
  if (left === undefined) {
    return right;
  }
  if (right === undefined) {
    return left;
  }
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}

function latestIsoDate(left: IsoDateString | undefined, right: IsoDateString | undefined): IsoDateString | undefined {
  if (left === undefined) {
    return right;
  }
  if (right === undefined) {
    return left;
  }
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function compareContributors(left: ContributorSummary, right: ContributorSummary): number {
  if (left.commitCount !== right.commitCount) {
    return right.commitCount - left.commitCount;
  }
  if (left.additions !== right.additions) {
    return right.additions - left.additions;
  }
  return left.email.localeCompare(right.email);
}
