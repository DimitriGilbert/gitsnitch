import { describe, expect, it } from "vitest";

import type { CommitRecord, ContributorSummary, LineCountResult } from "../src/index";

import {
  calculateBusFactor,
  calculateChurnRate,
  calculateCodeQualityMetrics,
  calculateGiniCoefficient,
  calculateHealthScore,
  generateHealthRecommendations,
  getHealthScoreRating,
} from "../src/index";

const baseCommit = {
  shortHash: "abc1234",
  message: "feat: update",
  author: { name: "Ada Lovelace", email: "ada@example.test" },
  authoredAt: "2024-01-02T03:04:05.000Z",
  committedAt: "2024-01-02T03:04:05.000Z",
  parents: [],
  refs: [],
  classification: "feature",
} satisfies Omit<CommitRecord, "hash" | "files">;

const emptyLoc = {
  totalSource: 0,
  totalBlank: 0,
  totalComment: 0,
  totalLines: 0,
  byLanguage: [],
  skippedFiles: [],
} satisfies LineCountResult;

describe("quality metric calculations", () => {
  it("returns stable zero-state metrics for empty reports", () => {
    const metrics = calculateCodeQualityMetrics([], emptyLoc, []);

    expect(metrics).toEqual({
      churnRate: 0,
      busFactor: 0,
      ownershipConcentration: 0,
      avgCommitSize: 0,
      codeStability: 1,
      commentRatio: 0,
      healthScore: 90,
    });
    expect(generateHealthRecommendations(metrics, [])).toEqual([]);
  });

  it("calculates churn from sparse file stats without assuming commit-level totals", () => {
    const commits = [
      createCommit("a", "Ada", "ada@example.test", [
        { path: "src/a.ts", additions: 10, deletions: 2 },
        { path: "README.md", additions: 3, deletions: 0 },
      ]),
      createCommit("b", "Grace", "grace@example.test", []),
    ];

    expect(calculateChurnRate(commits)).toBe(8);
    expect(calculateCodeQualityMetrics(commits, emptyLoc, []).avgCommitSize).toBe(7);
  });

  it("calculates bus factor from contributor summaries and handles one contributor", () => {
    const contributors = [
      createContributor("Ada", "ada@example.test", 7),
      createContributor("Grace", "grace@example.test", 2),
      createContributor("Katherine", "katherine@example.test", 1),
    ];

    expect(calculateBusFactor(contributors)).toBe(2);
    expect(calculateBusFactor([createContributor("Ada", "ada@example.test", 3)])).toBe(1);
  });

  it("calculates ownership concentration from additions by author", () => {
    const commits = [
      createCommit("a", "Ada", "ada@example.test", [{ path: "a.ts", additions: 90, deletions: 0 }]),
      createCommit("b", "Grace", "grace@example.test", [{ path: "b.ts", additions: 10, deletions: 0 }]),
    ];

    expect(calculateGiniCoefficient(commits)).toBe(0.4);
    expect(calculateGiniCoefficient([createCommit("c", "Ada", "ada@example.test", [])])).toBe(0);
  });

  it("scores and rates unhealthy quality signals deterministically", () => {
    const metrics = {
      churnRate: 600,
      busFactor: 1,
      ownershipConcentration: 0.75,
      avgCommitSize: 350,
      codeStability: 4,
      commentRatio: 2,
    };

    expect(calculateHealthScore(metrics, [createCommit("risk", "Ada", "ada@example.test", [])])).toBe(35);
    expect(getHealthScoreRating(30)).toEqual({ label: "Critical", color: "#dc2626", emoji: "❌" });
    expect(getHealthScoreRating(75).label).toBe("Good");
  });

  it("generates actionable recommendations only for triggered risks", () => {
    const commits = [createCommit("a", "Ada", "ada@example.test", [{ path: "large.ts", additions: 700, deletions: 20 }])];
    const metrics = calculateCodeQualityMetrics(
      commits,
      emptyLoc,
      [createContributor("Ada", "ada@example.test", 1)],
    );

    expect(generateHealthRecommendations(metrics, commits)).toEqual([
      expect.objectContaining({ severity: "high", category: "Bus Factor" }),
      expect.objectContaining({ severity: "medium", category: "Commit Size" }),
      expect.objectContaining({ severity: "low", category: "Documentation" }),
      expect.objectContaining({ severity: "medium", category: "Code Churn" }),
    ]);
  });
});

function createCommit(
  hash: string,
  name: string,
  email: string,
  files: readonly { readonly path: string; readonly additions: number; readonly deletions: number }[],
): CommitRecord {
  return {
    ...baseCommit,
    hash,
    shortHash: hash.slice(0, 7),
    author: { name, email },
    files: files.map((file) => ({ ...file, status: "modified" })),
  };
}

function createContributor(name: string, email: string, commitCount: number): ContributorSummary {
  return {
    name,
    email,
    commitCount,
    additions: 0,
    deletions: 0,
    filesChanged: 0,
  };
}
