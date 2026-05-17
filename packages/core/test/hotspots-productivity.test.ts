import { describe, expect, it } from "vitest";

import type { CommitRecord, ContributorSummary } from "../src/index";

import {
  analyzeDevelopmentRhythm,
  calculateCollaborationScore,
  calculateFocusTime,
  calculateRiskLevel,
  calculateVelocity,
  findFileHotspots,
  findPeakDays,
  findPeakHours,
  generateProductivityInsights,
} from "../src/index";

const baseContributor = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  commitCount: 1,
  additions: 0,
  deletions: 0,
  filesChanged: 0,
} satisfies ContributorSummary;

function commit(overrides: {
  readonly hash: string;
  readonly authorName?: string;
  readonly authorEmail?: string;
  readonly committedAt: string;
  readonly additions?: number;
  readonly deletions?: number;
  readonly files?: CommitRecord["files"];
}): CommitRecord {
  const shortHash = overrides.hash.slice(0, 7);

  return {
    hash: overrides.hash,
    shortHash,
    message: `commit ${shortHash}`,
    author: {
      name: overrides.authorName ?? "Ada Lovelace",
      email: overrides.authorEmail ?? "ada@example.com",
    },
    authoredAt: overrides.committedAt,
    committedAt: overrides.committedAt,
    parents: [],
    refs: [],
    classification: "other",
    files: overrides.files ?? [
      {
        path: "src/app.ts",
        additions: overrides.additions ?? 0,
        deletions: overrides.deletions ?? 0,
        status: "modified",
      },
    ],
  };
}

describe("file hotspot analysis", () => {
  it("returns no hotspots for zero commits and sparse file stats", () => {
    expect(findFileHotspots([])).toEqual([]);
    expect(
      findFileHotspots([
        commit({ hash: "a000001", committedAt: "2024-01-01T10:00:00.000Z", files: [] }),
      ]),
    ).toEqual([]);
  });

  it("ranks changed files by frequency, churn, and contributor count", () => {
    const commits = [
      commit({ hash: "a000001", committedAt: "2024-01-01T09:00:00.000Z", additions: 10, deletions: 2 }),
      commit({
        hash: "b000001",
        authorName: "Grace Hopper",
        authorEmail: "grace@example.com",
        committedAt: "2024-01-02T09:00:00.000Z",
        additions: 80,
        deletions: 20,
      }),
      commit({
        hash: "c000001",
        committedAt: "2024-01-03T09:00:00.000Z",
        files: [{ path: "docs/readme.md", additions: 5, deletions: 0, status: "modified" }],
      }),
    ];

    expect(findFileHotspots(commits, 1)).toEqual([
      expect.objectContaining({
        path: "src/app.ts",
        changeCount: 2,
        additions: 90,
        deletions: 22,
        churn: 112,
        contributorCount: 2,
        contributors: ["ada@example.com", "grace@example.com"],
        lastChangedAt: "2024-01-02T09:00:00.000Z",
      }),
    ]);
  });

  it("classifies risk from changes, churn, and knowledge concentration", () => {
    expect(calculateRiskLevel(1, 10, 2)).toEqual({ level: "low", color: "#22c55e", emoji: "🟢" });
    expect(calculateRiskLevel(12, 600, 4).level).toBe("medium");
    expect(calculateRiskLevel(21, 1_100, 6).level).toBe("high");
    expect(calculateRiskLevel(1, 10, 1).level).toBe("low");
  });
});

describe("productivity analysis", () => {
  it("returns explicit empty-state metrics for zero commits", () => {
    expect(generateProductivityInsights([], [], 30)).toEqual({
      contributorCount: 0,
      peakHours: { hour: 0, hourFormatted: "00:00", commits: 0, percentage: 0 },
      peakDays: { day: 0, dayName: "Unknown", commits: 0, percentage: 0 },
      velocity: { linesPerDay: 0, commitsPerDay: 0, velocity: "unknown", totalLines: 0 },
      rhythm: { consistency: "unknown", avgDaysBetweenCommits: 0, rhythmScore: 0, standardDeviation: 0 },
      collaboration: { score: 0, multiAuthorFiles: 0, totalFiles: 0, collaborationLevel: "none" },
      focusTime: {
        workingHoursCommits: 0,
        workingHoursPercent: 0,
        afterHoursCommits: 0,
        afterHoursPercent: 0,
        weekendCommits: 0,
        weekendPercent: 0,
        workLifeBalance: "unknown",
      },
    });
  });

  it("finds peak hours and days deterministically from ISO dates", () => {
    const commits = [
      commit({ hash: "a000001", committedAt: "2024-01-01T10:15:00.000Z" }),
      commit({ hash: "b000001", committedAt: "2024-01-01T10:45:00.000Z" }),
      commit({ hash: "c000001", committedAt: "2024-01-02T18:00:00.000Z" }),
    ];

    expect(findPeakHours(commits)).toEqual({ hour: 10, hourFormatted: "10:00", commits: 2, percentage: 66.7 });
    expect(findPeakDays(commits)).toEqual({ day: 1, dayName: "Monday", commits: 2, percentage: 66.7 });
  });

  it("calculates velocity, rhythm, collaboration, and focus for sparse teams", () => {
    const commits = [
      commit({ hash: "a000001", committedAt: "2024-01-01T10:00:00.000Z", additions: 300 }),
      commit({
        hash: "b000001",
        authorName: "Grace Hopper",
        authorEmail: "grace@example.com",
        committedAt: "2024-01-02T22:00:00.000Z",
        additions: 200,
      }),
      commit({
        hash: "c000001",
        committedAt: "2024-01-06T12:00:00.000Z",
        additions: 100,
        files: [{ path: "docs/readme.md", additions: 100, deletions: 0, status: "modified" }],
      }),
    ];

    expect(calculateVelocity(commits, 3)).toEqual({
      linesPerDay: 200,
      commitsPerDay: 1,
      velocity: "low",
      totalLines: 600,
    });
    expect(analyzeDevelopmentRhythm(commits)).toEqual({
      consistency: "highly-consistent",
      avgDaysBetweenCommits: 2.54,
      rhythmScore: 90,
      standardDeviation: 1.04,
    });
    expect(calculateCollaborationScore(commits)).toEqual({
      score: 50,
      multiAuthorFiles: 1,
      totalFiles: 2,
      collaborationLevel: "medium",
    });
    expect(calculateFocusTime(commits)).toEqual({
      workingHoursCommits: 1,
      workingHoursPercent: 33.3,
      afterHoursCommits: 1,
      afterHoursPercent: 33.3,
      weekendCommits: 1,
      weekendPercent: 33.3,
      workLifeBalance: "poor",
    });
  });

  it("handles one commit and one contributor without inflated collaboration or rhythm", () => {
    const commits = [commit({ hash: "a000001", committedAt: "2024-01-01T10:00:00.000Z", additions: 10 })];

    expect(generateProductivityInsights(commits, [baseContributor], 7)).toEqual(
      expect.objectContaining({
        contributorCount: 1,
        rhythm: { consistency: "unknown", avgDaysBetweenCommits: 0, rhythmScore: 0, standardDeviation: 0 },
        collaboration: { score: 0, multiAuthorFiles: 0, totalFiles: 1, collaborationLevel: "low" },
      }),
    );
  });
});
