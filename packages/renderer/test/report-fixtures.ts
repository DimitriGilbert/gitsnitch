import type { RepoReportData, ScanReportData } from "@git-snitch/core";

const isoDate = "2024-01-02T03:04:05.000Z";

export const repoReportFixture: RepoReportData = {
  kind: "repo",
  generatedAt: isoDate,
  repository: {
    name: "fixture-repo",
    path: "/workspace/fixture-repo",
    rootPath: "/workspace/fixture-repo",
    currentBranch: "main",
    totalCommits: 1,
    totalContributors: 1,
  },
  options: {
    repoPath: "/workspace/fixture-repo",
    branches: ["main"],
    allBranches: false,
    overwrite: true,
    open: false,
    format: "html",
  },
  commits: [
    {
      hash: "1234567890abcdef",
      shortHash: "1234567",
      message: "feat: add renderer fixture",
      author: { name: "Ada Lovelace", email: "ada@example.test" },
      authoredAt: isoDate,
      committedAt: isoDate,
      parents: [],
      refs: ["main"],
      classification: "feature",
      files: [{ path: "src/index.ts", additions: 12, deletions: 1, status: "modified" }],
    },
  ],
  contributors: [
    {
      name: "Ada Lovelace",
      email: "ada@example.test",
      commitCount: 1,
      additions: 12,
      deletions: 1,
      filesChanged: 1,
      firstCommitAt: isoDate,
      lastCommitAt: isoDate,
    },
  ],
  analysis: {
    languages: [{ language: "TypeScript", files: 1, lines: 42 }],
    hotspots: [
      {
        path: "src/index.ts",
        changeCount: 1,
        additions: 12,
        deletions: 1,
        contributorCount: 1,
        contributors: ["Ada Lovelace"],
        churn: 13,
        lastChangedAt: isoDate,
        hotspotScore: 13,
        riskLevel: { level: "low", color: "green", emoji: "low" },
      },
    ],
    cadence: [{ period: "2024-01", commits: 1 }],
    qualitySignals: [],
  },
};

export const scanReportFixture: ScanReportData = {
  kind: "scan",
  generatedAt: isoDate,
  directory: "/workspace",
  options: {
    directory: "/workspace",
    scan: { maxDepth: 3, includePatterns: ["*"], excludePatterns: ["node_modules"] },
    overwrite: true,
    open: false,
    format: "html",
  },
  projects: [{ repository: { ...repoReportFixture.repository, id: "fixture-repo", relativePath: "fixture-repo" }, report: repoReportFixture }],
  analysis: {
    totalCommits: 1,
    totalContributors: 1,
    totalRepositories: 1,
    languages: [{ language: "TypeScript", files: 1, lines: 42 }],
    qualitySignals: [],
  },
};
