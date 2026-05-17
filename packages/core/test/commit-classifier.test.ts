import { describe, expect, it } from "vitest";

import type { CommitRecord } from "../src/index";

import { analyzeCommitMessageQuality, classifyCommit, generateCommitTypeBreakdown } from "../src/index";

describe("commit classification", () => {
  it("classifies conventional commit messages by public type", () => {
    expect(classifyCommit("feat(parser): support branch filters")).toBe("feature");
    expect(classifyCommit("fix!: reject invalid config")).toBe("bugfix");
    expect(classifyCommit("docs: explain scan mode")).toBe("docs");
  });

  it("classifies merge, revert, heuristic, empty, and ambiguous messages deterministically", () => {
    expect(classifyCommit("Merge pull request #42 from team/feature")).toBe("merge");
    expect(classifyCommit('Revert "feat: add scan report"')).toBe("revert");
    expect(classifyCommit("resolve parser issue for empty repos")).toBe("bugfix");
    expect(classifyCommit("introduce standalone renderer")).toBe("feature");
    expect(classifyCommit("   ")).toBe("other");
    expect(classifyCommit("misc cleanup")).toBe("other");
  });
});

describe("commit type breakdown", () => {
  it("counts classifications through commit records without mutating git operation classifications", () => {
    const commits = [
      createCommit("a", "feat: add reports"),
      createCommit("b", "fix: handle empty repos"),
      createCommit("c", "Merge branch 'main'"),
      createCommit("d", "unclear"),
    ];

    expect(generateCommitTypeBreakdown(commits)).toEqual({
      feature: 1,
      bugfix: 1,
      merge: 1,
      other: 1,
    });
    expect(commits.map((commit) => commit.classification)).toEqual(["other", "other", "other", "other"]);
  });
});

describe("commit message quality", () => {
  it("returns stable zero-state quality for empty commit lists", () => {
    expect(analyzeCommitMessageQuality([])).toEqual({
      totalCommits: 0,
      conventionalCommitCount: 0,
      goodSummaryLengthCount: 0,
      describedCommitCount: 0,
      noSummaryPunctuationCount: 0,
      emptyMessageCount: 0,
      ambiguousMessageCount: 0,
      conventionalCommitsPercent: 0,
      goodSummaryLengthPercent: 0,
      hasDescriptionPercent: 0,
      noPunctuationPercent: 0,
      emptyMessagePercent: 0,
      ambiguousMessagePercent: 0,
      overallScore: 0,
    });
  });

  it("scores message quality from observable commit messages", () => {
    const commits = [
      createCommit("a", "feat: add scan report", "Explain generated HTML output."),
      createCommit("b", "fix bug."),
      createCommit("c", ""),
      createCommit("d", "misc cleanup"),
    ];

    expect(analyzeCommitMessageQuality(commits)).toMatchObject({
      totalCommits: 4,
      conventionalCommitCount: 1,
      goodSummaryLengthCount: 2,
      describedCommitCount: 1,
      noSummaryPunctuationCount: 2,
      emptyMessageCount: 1,
      ambiguousMessageCount: 2,
      conventionalCommitsPercent: 25,
      goodSummaryLengthPercent: 50,
      hasDescriptionPercent: 25,
      noPunctuationPercent: 50,
      emptyMessagePercent: 25,
      ambiguousMessagePercent: 50,
      overallScore: 36,
    });
  });
});

function createCommit(hash: string, message: string, body?: string): CommitRecord {
  const commitWithoutBody: Omit<CommitRecord, "body"> = {
    hash,
    shortHash: hash.slice(0, 7),
    message,
    author: { name: "Ada Lovelace", email: "ada@example.test" },
    authoredAt: "2024-01-02T03:04:05.000Z",
    committedAt: "2024-01-02T03:04:05.000Z",
    parents: [],
    refs: [],
    classification: "other",
    files: [],
  };

  return body === undefined ? commitWithoutBody : { ...commitWithoutBody, body };
}
