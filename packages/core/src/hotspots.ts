import type { FileHotspot, FileRiskLevel } from "./analysis";
import type { CommitRecord } from "./commits";
import type { IsoDateString } from "./json";

interface MutableFileStats {
  changes: number;
  additions: number;
  deletions: number;
  contributors: Set<string>;
  lastChangedAt: IsoDateString;
}

/**
 * Finds frequently changed, high-churn files from commit file statistics.
 * Commits without file stats simply do not contribute hotspots.
 */
export function findFileHotspots(commits: readonly CommitRecord[], limit = 20): readonly FileHotspot[] {
  if (commits.length === 0 || limit <= 0) {
    return [];
  }

  const fileStats = new Map<string, MutableFileStats>();
  for (const commit of commits) {
    for (const file of commit.files) {
      const existing = fileStats.get(file.path);
      const contributor = commit.author.email.trim().toLowerCase() || commit.author.name.trim();
      if (existing === undefined) {
        fileStats.set(file.path, {
          changes: 1,
          additions: file.additions,
          deletions: file.deletions,
          contributors: new Set([contributor]),
          lastChangedAt: commit.committedAt,
        });
        continue;
      }

      existing.changes += 1;
      existing.additions += file.additions;
      existing.deletions += file.deletions;
      existing.contributors.add(contributor);
      if (new Date(commit.committedAt).getTime() > new Date(existing.lastChangedAt).getTime()) {
        existing.lastChangedAt = commit.committedAt;
      }
    }
  }

  return [...fileStats.entries()]
    .map(([path, stats]) => toFileHotspot(path, stats))
    .sort(compareHotspots)
    .slice(0, limit);
}

/** Calculates user-facing risk metadata for a file hotspot. */
export function calculateRiskLevel(changes: number, churn: number, authorCount: number): FileRiskLevel {
  let riskScore = 0;

  if (changes > 20) {
    riskScore += 30;
  } else if (changes > 10) {
    riskScore += 20;
  } else if (changes > 5) {
    riskScore += 10;
  }

  if (churn > 1_000) {
    riskScore += 30;
  } else if (churn > 500) {
    riskScore += 20;
  } else if (churn > 200) {
    riskScore += 10;
  }

  if (authorCount > 5) {
    riskScore += 20;
  } else if (authorCount > 3) {
    riskScore += 10;
  } else if (authorCount === 1) {
    riskScore += 15;
  }

  if (riskScore > 60) {
    return { level: "high", color: "#dc2626", emoji: "🔴" };
  }
  if (riskScore > 30) {
    return { level: "medium", color: "#f97316", emoji: "🟡" };
  }
  return { level: "low", color: "#22c55e", emoji: "🟢" };
}

function toFileHotspot(path: string, stats: MutableFileStats): FileHotspot {
  const contributorCount = stats.contributors.size;
  const churn = stats.additions + stats.deletions;
  const hotspotScore = Math.round(stats.changes * Math.log(churn + 1) * Math.sqrt(Math.max(contributorCount, 1)));

  return {
    path,
    changeCount: stats.changes,
    additions: stats.additions,
    deletions: stats.deletions,
    contributorCount,
    contributors: [...stats.contributors].sort(),
    churn,
    lastChangedAt: stats.lastChangedAt,
    hotspotScore,
    riskLevel: calculateRiskLevel(stats.changes, churn, contributorCount),
  };
}

function compareHotspots(left: FileHotspot, right: FileHotspot): number {
  if (right.hotspotScore !== left.hotspotScore) {
    return right.hotspotScore - left.hotspotScore;
  }
  if (right.changeCount !== left.changeCount) {
    return right.changeCount - left.changeCount;
  }
  return left.path.localeCompare(right.path);
}
