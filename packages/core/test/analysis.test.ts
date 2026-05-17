import { describe, expect, it } from "vitest";

import type { CommitRecord, ContributorAggregateProject, ContributorSummary, IsoDateString } from "../src/index";

import {
  aggregateContributors,
  calculateProjectStats,
  calculateTimingStats,
  filterCommitsByDate,
  generateContributorStats,
  sortCommits,
} from "../src/index";

describe("commit and project analysis", () => {
  it("returns zeroed project and timing stats for an empty commit list", () => {
    expect(calculateProjectStats([])).toEqual({
      totalCommits: 0,
      totalContributors: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      avgAdditions: 0,
      avgDeletions: 0,
      avgTimeBetweenCommits: { avgHours: 0, avgDays: 0 },
    });
    expect(calculateTimingStats([])).toEqual({ avgHours: 0, avgDays: 0 });
  });

  it("summarizes commits using file stats and tolerates commits with no file stats", () => {
    const commits = [
      commit({ hash: "a1", email: "ada@example.test", authoredAt: "2024-01-01T00:00:00.000Z", additions: 12, deletions: 3 }),
      commit({ hash: "b2", email: "ada@example.test", authoredAt: "2024-01-03T00:00:00.000Z" }),
    ];

    expect(calculateProjectStats(commits)).toEqual({
      totalCommits: 2,
      totalContributors: 1,
      totalAdditions: 12,
      totalDeletions: 3,
      avgAdditions: 6,
      avgDeletions: 2,
      avgTimeBetweenCommits: { avgHours: 48, avgDays: 2 },
    });
  });

  it("sorts commits by date and churn without mutating the caller's list", () => {
    const oldest = commit({ hash: "old", authoredAt: "2024-01-01T00:00:00.000Z", additions: 4, deletions: 1 });
    const newest = commit({ hash: "new", authoredAt: "2024-01-02T00:00:00.000Z", additions: 1, deletions: 9 });
    const commits = [oldest, newest];

    expect(sortCommits(commits, "date", "desc").map((item) => item.hash)).toEqual(["new", "old"]);
    expect(sortCommits(commits, "additions", "asc").map((item) => item.hash)).toEqual(["new", "old"]);
    expect(sortCommits(commits, "deletions", "desc").map((item) => item.hash)).toEqual(["new", "old"]);
    expect(commits.map((item) => item.hash)).toEqual(["old", "new"]);
  });

  it("filters commits inclusively with ISO string and Date boundaries", () => {
    const commits = [
      commit({ hash: "before", authoredAt: "2024-01-01T00:00:00.000Z" }),
      commit({ hash: "inside", authoredAt: "2024-01-02T00:00:00.000Z" }),
      commit({ hash: "end", authoredAt: "2024-01-03T00:00:00.000Z" }),
      commit({ hash: "after", authoredAt: "2024-01-04T00:00:00.000Z" }),
    ];

    const filtered = filterCommitsByDate(commits, "2024-01-02T00:00:00.000Z", new Date("2024-01-03T00:00:00.000Z"));

    expect(filtered.map((item) => item.hash)).toEqual(["inside", "end"]);
  });
});

describe("contributor analysis", () => {
  it("groups commits by contributor identity and reports first and last activity", () => {
    const commits = [
      commit({ hash: "a", name: "Ada", email: "ada@example.test", authoredAt: "2024-01-03T00:00:00.000Z", additions: 8, deletions: 2 }),
      commit({ hash: "b", name: "Grace", email: "grace@example.test", authoredAt: "2024-01-02T00:00:00.000Z", additions: 1 }),
      commit({ hash: "c", name: "Ada", email: "ada@example.test", authoredAt: "2024-01-01T00:00:00.000Z", additions: 4 }),
    ];

    expect(generateContributorStats(commits)).toEqual([
      {
        name: "Ada",
        email: "ada@example.test",
        commitCount: 2,
        additions: 12,
        deletions: 2,
        filesChanged: 2,
        firstCommitAt: "2024-01-01T00:00:00.000Z",
        lastCommitAt: "2024-01-03T00:00:00.000Z",
      },
      {
        name: "Grace",
        email: "grace@example.test",
        commitCount: 1,
        additions: 1,
        deletions: 0,
        filesChanged: 1,
        firstCommitAt: "2024-01-02T00:00:00.000Z",
        lastCommitAt: "2024-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("aggregates contributors across scan projects by email", () => {
    const projects: readonly ContributorAggregateProject[] = [
      projectWithContributors([
        contributor({ name: "Ada", email: "ada@example.test", commitCount: 2, additions: 10, firstCommitAt: "2024-01-01T00:00:00.000Z" }),
      ]),
      projectWithContributors([
        contributor({ name: "Ada Lovelace", email: "ADA@example.test", commitCount: 3, deletions: 4, lastCommitAt: "2024-01-05T00:00:00.000Z" }),
      ]),
    ];

    expect(aggregateContributors(projects)).toEqual([
      {
        name: "Ada",
        email: "ada@example.test",
        commitCount: 5,
        additions: 10,
        deletions: 4,
        filesChanged: 0,
        firstCommitAt: "2024-01-01T00:00:00.000Z",
        lastCommitAt: "2024-01-05T00:00:00.000Z",
      },
    ]);
  });
});

interface CommitInput {
  readonly hash: string;
  readonly name?: string;
  readonly email?: string;
  readonly authoredAt?: IsoDateString;
  readonly additions?: number;
  readonly deletions?: number;
}

function commit(input: CommitInput): CommitRecord {
  const authoredAt = input.authoredAt ?? "2024-01-01T00:00:00.000Z";
  const additions = input.additions ?? 0;
  const deletions = input.deletions ?? 0;
  const files = additions > 0 || deletions > 0 ? [{ path: `${input.hash}.ts`, additions, deletions, status: "modified" as const }] : [];

  return {
    hash: input.hash,
    shortHash: input.hash.slice(0, 7),
    message: "feat: deterministic test commit",
    author: {
      name: input.name ?? "Ada",
      email: input.email ?? "ada@example.test",
    },
    authoredAt,
    committedAt: authoredAt,
    parents: [],
    refs: [],
    classification: "feature",
    files,
  };
}

interface ContributorInput {
  readonly name: string;
  readonly email: string;
  readonly commitCount: number;
  readonly additions?: number;
  readonly deletions?: number;
  readonly filesChanged?: number;
  readonly firstCommitAt?: IsoDateString;
  readonly lastCommitAt?: IsoDateString;
}

function contributor(input: ContributorInput): ContributorSummary {
  return {
    name: input.name,
    email: input.email,
    commitCount: input.commitCount,
    additions: input.additions ?? 0,
    deletions: input.deletions ?? 0,
    filesChanged: input.filesChanged ?? 0,
    firstCommitAt: input.firstCommitAt,
    lastCommitAt: input.lastCommitAt,
  };
}

function projectWithContributors(contributors: readonly ContributorSummary[]): ContributorAggregateProject {
  return { report: { contributors } };
}
