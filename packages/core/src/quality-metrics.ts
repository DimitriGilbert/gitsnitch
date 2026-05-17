import type {
  CodeQualityMetrics,
  CodeQualityMetricsWithoutHealthScore,
  HealthRecommendation,
  HealthScoreRating,
} from "./analysis";
import type { CommitRecord } from "./commits";
import type { ContributorSummary } from "./contributors";
import type { LineCountResult } from "./git/types";

/**
 * Calculates repository quality metrics from public report data.
 * Sparse commit file statistics are treated as zero churn for that commit.
 */
export function calculateCodeQualityMetrics(
  commits: readonly CommitRecord[],
  loc: LineCountResult | undefined,
  contributors: readonly ContributorSummary[],
): CodeQualityMetrics {
  const metrics: CodeQualityMetricsWithoutHealthScore = {
    churnRate: calculateChurnRate(commits),
    busFactor: calculateBusFactor(contributors),
    ownershipConcentration: calculateGiniCoefficient(commits),
    avgCommitSize: calculateAverageCommitSize(commits),
    codeStability: calculateCodeStability(commits),
    commentRatio: calculateCommentRatio(loc),
  };

  return {
    ...metrics,
    healthScore: calculateHealthScore(metrics, commits),
  };
}

/** Calculates average changed lines per commit. */
export function calculateChurnRate(commits: readonly CommitRecord[]): number {
  if (commits.length === 0) {
    return 0;
  }

  return Math.round(totalChurn(commits) / commits.length);
}

/** Calculates how many contributors account for at least 80% of commits. */
export function calculateBusFactor(contributors: readonly ContributorSummary[]): number {
  if (contributors.length === 0) {
    return 0;
  }

  const commitCounts = contributors.map((contributor) => contributor.commitCount).filter((count) => count > 0).sort(descending);
  const totalCommits = commitCounts.reduce(sumNumbers, 0);
  if (totalCommits === 0) {
    return 0;
  }

  const threshold = totalCommits * 0.8;
  let coveredCommits = 0;
  let neededContributors = 0;

  for (const commitCount of commitCounts) {
    coveredCommits += commitCount;
    neededContributors += 1;
    if (coveredCommits >= threshold) {
      return neededContributors;
    }
  }

  return neededContributors;
}

/**
 * Calculates Gini coefficient for contribution ownership from additions by author.
 * Returns 0 for empty commit sets, one contributor, or commits with no additions.
 */
export function calculateGiniCoefficient(commits: readonly CommitRecord[]): number {
  if (commits.length === 0) {
    return 0;
  }

  const additionsByAuthor = new Map<string, number>();
  for (const commit of commits) {
    const key = authorKey(commit);
    additionsByAuthor.set(key, (additionsByAuthor.get(key) ?? 0) + commitAdditions(commit));
  }

  const values = [...additionsByAuthor.values()].sort(ascending);
  const contributorCount = values.length;
  const totalAdditions = values.reduce(sumNumbers, 0);
  if (contributorCount <= 1 || totalAdditions === 0) {
    return 0;
  }

  const weightedSum = values.reduce((sum, value, index) => sum + (contributorCount - index) * value, 0);
  const gini = (2 * weightedSum) / (contributorCount * totalAdditions) - (contributorCount + 1) / contributorCount;
  return roundToTwoDecimals(Math.abs(gini));
}

/** Calculates a 0-100 health score from quality metrics. */
export function calculateHealthScore(metrics: CodeQualityMetricsWithoutHealthScore, commits: readonly CommitRecord[]): number {
  let score = 100;

  const hasObservedCommits = commits.length > 0;

  if (hasObservedCommits && metrics.busFactor === 1) {
    score -= 20;
  } else if (hasObservedCommits && metrics.busFactor === 2) {
    score -= 10;
  }

  if (metrics.ownershipConcentration > 0.7) {
    score -= 15;
  } else if (metrics.ownershipConcentration > 0.5) {
    score -= 8;
  }

  if (metrics.avgCommitSize > 500) {
    score -= 10;
  } else if (metrics.avgCommitSize > 200) {
    score -= 5;
  }

  if (metrics.commentRatio < 5) {
    score -= 10;
  } else if (metrics.commentRatio < 10) {
    score -= 5;
  }

  if (metrics.codeStability > 3 || metrics.codeStability < 0.5) {
    score -= 10;
  }

  if (metrics.churnRate > 1_000) {
    score -= 10;
  } else if (metrics.churnRate > 500) {
    score -= 5;
  }

  return clampScore(score);
}

/** Returns display metadata for a numeric health score. */
export function getHealthScoreRating(score: number): HealthScoreRating {
  if (score >= 90) {
    return { label: "Excellent", color: "#22c55e", emoji: "🌟" };
  }
  if (score >= 75) {
    return { label: "Good", color: "#22c55e", emoji: "✅" };
  }
  if (score >= 60) {
    return { label: "Fair", color: "#f59e0b", emoji: "⚠️" };
  }
  if (score >= 40) {
    return { label: "Poor", color: "#f97316", emoji: "⚠️" };
  }
  return { label: "Critical", color: "#dc2626", emoji: "❌" };
}

/** Generates actionable recommendations for triggered quality risks. */
export function generateHealthRecommendations(
  metrics: CodeQualityMetrics,
  commits: readonly CommitRecord[],
): readonly HealthRecommendation[] {
  if (commits.length === 0 && metrics.busFactor === 0 && metrics.churnRate === 0 && metrics.avgCommitSize === 0) {
    return [];
  }

  const recommendations: HealthRecommendation[] = [];

  if (metrics.busFactor > 0 && metrics.busFactor <= 2) {
    recommendations.push({
      severity: "high",
      category: "Bus Factor",
      message: `Only ${metrics.busFactor} contributor(s) account for 80% of commits. Consider distributing knowledge and code ownership.`,
      action: "Encourage pair programming and code reviews",
    });
  }

  if (metrics.ownershipConcentration > 0.6) {
    recommendations.push({
      severity: "medium",
      category: "Code Ownership",
      message: "High code ownership concentration detected. Some contributors may be overworked.",
      action: "Balance workload across team members",
    });
  }

  if (metrics.avgCommitSize > 300) {
    recommendations.push({
      severity: "medium",
      category: "Commit Size",
      message: `Average commit size is ${metrics.avgCommitSize} lines. Smaller, atomic commits are recommended.`,
      action: "Break down changes into smaller, focused commits",
    });
  }

  if (metrics.commentRatio < 10) {
    recommendations.push({
      severity: "low",
      category: "Documentation",
      message: `Comment ratio is ${metrics.commentRatio}%. Consider adding more code documentation.`,
      action: "Add comments for complex logic and public APIs",
    });
  }

  if (metrics.churnRate > 500) {
    recommendations.push({
      severity: "medium",
      category: "Code Churn",
      message: `High code churn detected (${metrics.churnRate} lines per commit). This may indicate unstable requirements.`,
      action: "Review requirements and architecture decisions",
    });
  }

  return recommendations;
}

function calculateAverageCommitSize(commits: readonly CommitRecord[]): number {
  if (commits.length === 0) {
    return 0;
  }

  return Math.round(commits.reduce((sum, commit) => sum + commitAdditions(commit), 0) / commits.length);
}

function calculateCodeStability(commits: readonly CommitRecord[]): number {
  if (commits.length === 0) {
    return 1;
  }

  const additions = commits.reduce((sum, commit) => sum + commitAdditions(commit), 0);
  const deletions = commits.reduce((sum, commit) => sum + commitDeletions(commit), 0);
  if (deletions === 0) {
    return additions > 0 ? 2 : 1;
  }

  return roundToTwoDecimals(additions / deletions);
}

function calculateCommentRatio(loc: LineCountResult | undefined): number {
  if (!loc || loc.totalSource === 0) {
    return 0;
  }

  return Math.round((loc.totalComment / loc.totalSource) * 1_000) / 10;
}

function totalChurn(commits: readonly CommitRecord[]): number {
  return commits.reduce((sum, commit) => sum + commitAdditions(commit) + commitDeletions(commit), 0);
}

function commitAdditions(commit: CommitRecord): number {
  return commit.files.reduce((sum, file) => sum + file.additions, 0);
}

function commitDeletions(commit: CommitRecord): number {
  return commit.files.reduce((sum, file) => sum + file.deletions, 0);
}

function authorKey(commit: CommitRecord): string {
  return `${commit.author.name}\u0000${commit.author.email}`;
}

function ascending(left: number, right: number): number {
  return left - right;
}

function descending(left: number, right: number): number {
  return right - left;
}

function sumNumbers(left: number, right: number): number {
  return left + right;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
