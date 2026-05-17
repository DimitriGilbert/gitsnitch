import type { CommitClassification, CommitRecord } from "./commits.js";

type ConventionalCommitToken =
  | "feat"
  | "feature"
  | "fix"
  | "bugfix"
  | "docs"
  | "refactor"
  | "test"
  | "chore"
  | "style"
  | "perf"
  | "ci"
  | "build"
  | "revert";

const conventionalTypeMap = {
  feat: "feature",
  feature: "feature",
  fix: "bugfix",
  bugfix: "bugfix",
  docs: "docs",
  refactor: "refactor",
  test: "test",
  chore: "chore",
  style: "style",
  perf: "perf",
  ci: "ci",
  build: "build",
  revert: "revert",
} satisfies Record<ConventionalCommitToken, CommitClassification>;

const conventionalCommitPattern = /^(feat|feature|fix|bugfix|docs|refactor|test|chore|style|perf|ci|build|revert)(?:\([^)]+\))?!?:/i;

/** Count of commits grouped by semantic message classification. */
export type CommitTypeBreakdown = Partial<Record<CommitClassification, number>>;

/** Message hygiene signals derived from commit summaries and bodies. */
export interface CommitMessageQuality {
  readonly totalCommits: number;
  readonly conventionalCommitCount: number;
  readonly goodSummaryLengthCount: number;
  readonly describedCommitCount: number;
  readonly noSummaryPunctuationCount: number;
  readonly emptyMessageCount: number;
  readonly ambiguousMessageCount: number;
  readonly conventionalCommitsPercent: number;
  readonly goodSummaryLengthPercent: number;
  readonly hasDescriptionPercent: number;
  readonly noPunctuationPercent: number;
  readonly emptyMessagePercent: number;
  readonly ambiguousMessagePercent: number;
  readonly overallScore: number;
}

type CommitMessageQualityCounts = Pick<
  CommitMessageQuality,
  | "conventionalCommitCount"
  | "goodSummaryLengthCount"
  | "describedCommitCount"
  | "noSummaryPunctuationCount"
  | "emptyMessageCount"
  | "ambiguousMessageCount"
>;

/**
 * Classify a commit message into the report's semantic type taxonomy.
 *
 * Conventional Commit prefixes are preferred over heuristics, while empty or
 * unclear messages are intentionally classified as `other`.
 */
export function classifyCommit(message: string): CommitClassification {
  const summary = message.trim().split("\n")[0]?.trim() ?? "";
  if (summary.length === 0) {
    return "other";
  }

  const conventionalMatch = conventionalCommitPattern.exec(summary);
  const conventionalToken = conventionalMatch?.[1]?.toLowerCase();
  if (isConventionalCommitToken(conventionalToken)) {
    return conventionalTypeMap[conventionalToken];
  }

  if (/^merge\b|\bmerge\b|\brebase\b/i.test(summary)) {
    return "merge";
  }
  if (/^revert\b/i.test(summary)) {
    return "revert";
  }
  if (/\b(fix|bug|issue|error|resolve|patch|repair)\b/i.test(summary)) {
    return "bugfix";
  }
  if (/\b(add|new|create|implement|introduce|support)\b/i.test(summary)) {
    return "feature";
  }
  if (/\b(update|change|modify|improve|enhance|refine|cleanup)\b/i.test(summary) && !/^misc\b/i.test(summary)) {
    return "refactor";
  }
  if (/\b(test|spec|testing)\b/i.test(summary)) {
    return "test";
  }
  if (/\b(doc|docs|readme|comment|documentation)\b/i.test(summary)) {
    return "docs";
  }
  if (/\b(format|indent|whitespace|prettier|eslint)\b/i.test(summary)) {
    return "style";
  }
  if (/\b(release|version|bump)\b/i.test(summary)) {
    return "release";
  }

  return "other";
}

/** Build a sparse count map of semantic commit types for the provided commits. */
export function generateCommitTypeBreakdown(commits: readonly Pick<CommitRecord, "message">[]): CommitTypeBreakdown {
  const breakdown: CommitTypeBreakdown = {};

  for (const commit of commits) {
    const type = classifyCommit(commit.message);
    breakdown[type] = (breakdown[type] ?? 0) + 1;
  }

  return breakdown;
}

/** Analyze commit message quality using summary length, description, convention, and punctuation signals. */
export function analyzeCommitMessageQuality(commits: readonly Pick<CommitRecord, "message" | "body">[]): CommitMessageQuality {
  const totalCommits = commits.length;
  const initialCounts: CommitMessageQualityCounts = {
    conventionalCommitCount: 0,
    goodSummaryLengthCount: 0,
    describedCommitCount: 0,
    noSummaryPunctuationCount: 0,
    emptyMessageCount: 0,
    ambiguousMessageCount: 0,
  };
  const counts = commits.reduce((current, commit) => {
    const lines = commit.message.split("\n");
    const summary = lines[0]?.trim() ?? "";
    const hasDescription =
      (commit.body?.trim().length ?? 0) > 0 || lines.slice(1).some((line) => line.trim().length > 0);
    const hasSummary = summary.length > 0;
    const classification = classifyCommit(commit.message);

    return {
      conventionalCommitCount: current.conventionalCommitCount + (isConventionalCommitSummary(summary) ? 1 : 0),
      goodSummaryLengthCount: current.goodSummaryLengthCount + (summary.length >= 10 && summary.length <= 72 ? 1 : 0),
      describedCommitCount: current.describedCommitCount + (hasDescription ? 1 : 0),
      noSummaryPunctuationCount:
        current.noSummaryPunctuationCount + (hasSummary && !/[.!?]$/.test(summary) ? 1 : 0),
      emptyMessageCount: current.emptyMessageCount + (hasSummary ? 0 : 1),
      ambiguousMessageCount: current.ambiguousMessageCount + (classification === "other" ? 1 : 0),
    };
  }, initialCounts);

  return {
    totalCommits,
    ...counts,
    conventionalCommitsPercent: percentage(counts.conventionalCommitCount, totalCommits),
    goodSummaryLengthPercent: percentage(counts.goodSummaryLengthCount, totalCommits),
    hasDescriptionPercent: percentage(counts.describedCommitCount, totalCommits),
    noPunctuationPercent: percentage(counts.noSummaryPunctuationCount, totalCommits),
    emptyMessagePercent: percentage(counts.emptyMessageCount, totalCommits),
    ambiguousMessagePercent: percentage(counts.ambiguousMessageCount, totalCommits),
    overallScore: calculateOverallQualityScore(counts, totalCommits),
  };
}

function isConventionalCommitToken(value: string | undefined): value is ConventionalCommitToken {
  return value !== undefined && value in conventionalTypeMap;
}

function isConventionalCommitSummary(summary: string): boolean {
  return conventionalCommitPattern.test(summary);
}

function percentage(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((count / total) * 1_000) / 10;
}

function calculateOverallQualityScore(
  counts: CommitMessageQualityCounts,
  total: number,
): number {
  if (total === 0) {
    return 0;
  }

  const weightedCount =
    counts.conventionalCommitCount * 0.3 +
    counts.goodSummaryLengthCount * 0.25 +
    counts.describedCommitCount * 0.25 +
    counts.noSummaryPunctuationCount * 0.2;
  return Math.round((weightedCount / total) * 100);
}
