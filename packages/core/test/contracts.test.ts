import { describe, expect, it } from "vitest";

import type { RepoReportData, ScanReportData } from "../src/index";

import {
  DEFAULT_SCAN_EXCLUDE_PATTERNS,
  DEFAULT_SCAN_INCLUDE_PATTERNS,
  DEFAULT_SCAN_MAX_DEPTH,
  gitSnitchConfigSchema,
  isRepoReportData,
  isScanReportData,
  repoReportOptionsSchema,
  reportDataDiscriminantSchema,
  scanReportOptionsSchema,
} from "../src/index";

describe("core contract schemas", () => {
  it("parses config with recursive scan defaults", () => {
    const config = gitSnitchConfigSchema.parse({});

    expect(config.scan).toEqual({
      maxDepth: DEFAULT_SCAN_MAX_DEPTH,
      includePatterns: [...DEFAULT_SCAN_INCLUDE_PATTERNS],
      excludePatterns: [...DEFAULT_SCAN_EXCLUDE_PATTERNS],
    });
    expect(config.report).toEqual({
      overwrite: true,
      open: false,
      format: "html",
    });
  });

  it("rejects branch options that request explicit branches and every branch", () => {
    const parsed = repoReportOptionsSchema.safeParse({
      repoPath: "/repo",
      branches: ["main"],
      allBranches: true,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Use either explicit branches or allBranches, not both");
    }
  });

  it("parses scan report options with user-controlled include and exclude patterns", () => {
    const options = scanReportOptionsSchema.parse({
      directory: "/workspace",
      scan: {
        maxDepth: 5,
        includePatterns: ["apps/*/.git"],
        excludePatterns: ["**/vendor/**"],
      },
    });

    expect(options.scan).toEqual({
      maxDepth: 5,
      includePatterns: ["apps/*/.git"],
      excludePatterns: ["**/vendor/**"],
    });
  });
});

describe("report discriminants", () => {
  it("narrows top-level report data by kind before consumers inspect the shape", () => {
    const repoReport = {
      kind: "repo",
      generatedAt: "2024-01-02T03:04:05.000Z",
    };
    const scanReport = {
      kind: "scan",
      generatedAt: "2024-01-02T03:04:05.000Z",
    };

    expect(reportDataDiscriminantSchema.parse(repoReport).kind).toBe("repo");
    expect(reportDataDiscriminantSchema.parse(scanReport).kind).toBe("scan");
  });

  it("rejects incomplete values for full report data guards", () => {
    const repoReport = {
      kind: "repo",
    };
    const scanReport = {
      kind: "scan",
    };

    expect(isRepoReportData(repoReport)).toBe(false);
    expect(isScanReportData(repoReport)).toBe(false);
    expect(isRepoReportData(scanReport)).toBe(false);
    expect(isScanReportData(scanReport)).toBe(false);
  });

  it("accepts complete minimal repo and scan report data", () => {
    const generatedAt = "2024-01-02T03:04:05.000Z";
    const repoReport = {
      kind: "repo",
      generatedAt,
      repository: {
        name: "example",
        path: "/workspace/example",
        rootPath: "/workspace/example",
        totalCommits: 0,
        totalContributors: 0,
      },
      options: {
        overwrite: true,
        open: false,
        format: "html",
        repoPath: "/workspace/example",
        branches: [],
        allBranches: false,
      },
      commits: [],
      contributors: [],
      analysis: {
        languages: [],
        hotspots: [],
        cadence: [],
        qualitySignals: [],
      },
    } satisfies RepoReportData;
    const scanReport = {
      kind: "scan",
      generatedAt,
      directory: "/workspace",
      options: {
        overwrite: true,
        open: false,
        format: "html",
        directory: "/workspace",
        scan: {
          maxDepth: 3,
          includePatterns: ["**/.git"],
          excludePatterns: ["**/node_modules/**"],
        },
      },
      projects: [
        {
          repository: {
            id: "example",
            relativePath: "example",
            name: "example",
            path: "/workspace/example",
            rootPath: "/workspace/example",
            totalCommits: 0,
            totalContributors: 0,
          },
          report: repoReport,
        },
      ],
      analysis: {
        totalCommits: 0,
        totalContributors: 0,
        totalRepositories: 1,
        languages: [],
        qualitySignals: [],
      },
    } satisfies ScanReportData;

    expect(isRepoReportData(repoReport)).toBe(true);
    expect(isScanReportData(repoReport)).toBe(false);
    expect(isRepoReportData(scanReport)).toBe(false);
    expect(isScanReportData(scanReport)).toBe(true);
  });
});
