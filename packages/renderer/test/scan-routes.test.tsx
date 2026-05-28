// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RepoReportData, ScanProjectReport, ScanReportData } from "@git-snitch/core";

import { App } from "../src/app";
import { ScanOverview, ScanProjectRoute, deriveCrossProjectContributors, deriveScanProjectRouteEntries, deriveScanProjectSlug } from "../src/scan-routes";
import { repoReportFixture, scanReportFixture } from "./report-fixtures";

function injectReport(report: RepoReportData | ScanReportData) {
  Object.defineProperty(window, "__GIT_SNITCH_REPORT_DATA__", {
    configurable: true,
    value: report,
  });
}

function projectFixture(id: string, relativePath: string, report: RepoReportData): ScanProjectReport {
  return {
    repository: {
      ...report.repository,
      id,
      relativePath,
      name: relativePath.split("/").at(-1) ?? report.repository.name,
      path: `/workspace/${relativePath}`,
      rootPath: `/workspace/${relativePath}`,
    },
    report: {
      ...report,
      repository: {
        ...report.repository,
        name: relativePath.split("/").at(-1) ?? report.repository.name,
        path: `/workspace/${relativePath}`,
        rootPath: `/workspace/${relativePath}`,
      },
    },
  };
}

function multiProjectScanReport(): ScanReportData {
  const baseCommit = repoReportFixture.commits.at(0);
  const baseContributor = repoReportFixture.contributors.at(0);

  if (!baseCommit || !baseContributor) {
    throw new Error("Expected repository fixture to include commit and contributor data");
  }

  const apiReport: RepoReportData = {
    ...repoReportFixture,
    repository: { ...repoReportFixture.repository, name: "api", path: "/workspace/services/api", rootPath: "/workspace/services/api", totalCommits: 2, totalContributors: 2 },
    commits: [
      baseCommit,
      {
        ...baseCommit,
        hash: "abcdef1234567890",
        shortHash: "abcdef1",
        message: "fix: stabilize api route",
        classification: "fix",
        files: [{ path: "services/api/index.ts", additions: 4, deletions: 2, status: "modified" }],
      },
    ],
    contributors: [
      { ...baseContributor, commitCount: 2, additions: 16, deletions: 3, filesChanged: 2 },
      { name: "Grace Hopper", email: "grace@example.test", commitCount: 1, additions: 4, deletions: 2, filesChanged: 1, firstCommitAt: repoReportFixture.generatedAt, lastCommitAt: repoReportFixture.generatedAt },
    ],
  };
  const webReport: RepoReportData = {
    ...repoReportFixture,
    repository: { ...repoReportFixture.repository, name: "web app", path: "/workspace/apps/web app", rootPath: "/workspace/apps/web app" },
    contributors: [{ ...baseContributor, commitCount: 1, additions: 12, deletions: 1, filesChanged: 1 }],
  };

  return {
    ...scanReportFixture,
    projects: [projectFixture("services/api", "services/api", apiReport), projectFixture("Apps/Web App", "apps/web app", webReport)],
    analysis: { ...scanReportFixture.analysis, totalRepositories: 2, totalCommits: 3, totalContributors: 2 },
  };
}

function scanReportWithAiUsage(): ScanReportData {
  const report = multiProjectScanReport();
  const firstProject = report.projects.at(0);
  const secondProject = report.projects.at(1);

  if (!firstProject || !secondProject) {
    throw new Error("Expected scan fixture to include two projects");
  }

  const firstUsage = {
    records: 4,
    tokens: { input: 200, output: 100, cacheRead: 30, cacheWrite: 20, reasoning: 50, total: 400 },
    cost: 0.25,
    breakdowns: {
      byClient: [{ key: "pi", records: 4, tokens: { input: 200, output: 100, cacheRead: 30, cacheWrite: 20, reasoning: 50, total: 400 }, cost: 0.25 }],
      byModel: [{ key: "pi-default", records: 4, tokens: { input: 200, output: 100, cacheRead: 30, cacheWrite: 20, reasoning: 50, total: 400 }, cost: 0.25 }],
      byDay: [{ key: "2024-01-02", records: 4, tokens: { input: 200, output: 100, cacheRead: 30, cacheWrite: 20, reasoning: 50, total: 400 }, cost: 0.25 }],
    },
  };
  const secondUsage = {
    records: 2,
    tokens: { input: 120, output: 60, cacheRead: 10, cacheWrite: 5, reasoning: 5, total: 200 },
    cost: 0.05,
    breakdowns: {
      byClient: [{ key: "claude", records: 2, tokens: { input: 120, output: 60, cacheRead: 10, cacheWrite: 5, reasoning: 5, total: 200 }, cost: 0.05 }],
      byModel: [{ key: "claude-sonnet", records: 2, tokens: { input: 120, output: 60, cacheRead: 10, cacheWrite: 5, reasoning: 5, total: 200 }, cost: 0.05 }],
      byDay: [{ key: "2024-01-03", records: 2, tokens: { input: 120, output: 60, cacheRead: 10, cacheWrite: 5, reasoning: 5, total: 200 }, cost: 0.05 }],
    },
  };

  return {
    ...report,
    projects: [
      { ...firstProject, report: { ...firstProject.report, aiUsage: firstUsage } },
      { ...secondProject, report: { ...secondProject.report, aiUsage: secondUsage } },
    ],
    analysis: {
      ...report.analysis,
      aiUsage: {
        records: 6,
        tokens: { input: 320, output: 160, cacheRead: 40, cacheWrite: 25, reasoning: 55, total: 600 },
        cost: 0.3,
        breakdowns: {
          byClient: [
            { key: "claude", records: 2, tokens: { input: 120, output: 60, cacheRead: 10, cacheWrite: 5, reasoning: 5, total: 200 }, cost: 0.05 },
            { key: "pi", records: 4, tokens: { input: 200, output: 100, cacheRead: 30, cacheWrite: 20, reasoning: 50, total: 400 }, cost: 0.25 },
          ],
          byModel: [
            { key: "claude-sonnet", records: 2, tokens: { input: 120, output: 60, cacheRead: 10, cacheWrite: 5, reasoning: 5, total: 200 }, cost: 0.05 },
            { key: "pi-default", records: 4, tokens: { input: 200, output: 100, cacheRead: 30, cacheWrite: 20, reasoning: 50, total: 400 }, cost: 0.25 },
          ],
          byDay: [
            { key: "2024-01-02", records: 4, tokens: { input: 200, output: 100, cacheRead: 30, cacheWrite: 20, reasoning: 50, total: 400 }, cost: 0.25 },
            { key: "2024-01-03", records: 2, tokens: { input: 120, output: 60, cacheRead: 10, cacheWrite: 5, reasoning: 5, total: 200 }, cost: 0.05 },
          ],
        },
      },
    },
  };
}

function emptyScanReport(): ScanReportData {
  return {
    ...scanReportFixture,
    projects: [],
    analysis: { ...scanReportFixture.analysis, totalRepositories: 0, totalCommits: 0, totalContributors: 0, languages: [], qualitySignals: [] },
  };
}

function scanReportWithoutSharedContributors(): ScanReportData {
  const report = multiProjectScanReport();
  const firstProject = report.projects.at(0);
  const secondProject = report.projects.at(1);

  if (!firstProject || !secondProject) {
    throw new Error("Expected scan fixture to include two projects");
  }

  return {
    ...report,
    projects: [
      {
        ...firstProject,
        report: {
          ...firstProject.report,
          contributors: [
            {
              name: "Grace Hopper",
              email: "grace@example.test",
              commitCount: 1,
              additions: 4,
              deletions: 2,
              filesChanged: 1,
              firstCommitAt: repoReportFixture.generatedAt,
              lastCommitAt: repoReportFixture.generatedAt,
            },
          ],
        },
      },
      {
        ...secondProject,
        report: {
          ...secondProject.report,
          contributors: [
            {
              name: "Katherine Johnson",
              email: "katherine@example.test",
              commitCount: 1,
              additions: 12,
              deletions: 1,
              filesChanged: 1,
              firstCommitAt: repoReportFixture.generatedAt,
              lastCommitAt: repoReportFixture.generatedAt,
            },
          ],
        },
      },
    ],
    analysis: { ...report.analysis, totalContributors: 2 },
  };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = "";
  Reflect.deleteProperty(window, "__GIT_SNITCH_REPORT_DATA__");
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: () => undefined,
});

describe("scan report routes", () => {
  it("renders aggregate stats, project comparison, and cross-project contributors", () => {
    render(<ScanOverview report={multiProjectScanReport()} />);

    expect(screen.getByText("max depth")).toBeTruthy();
    expect(screen.getByText("repositories")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Project comparison" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "api" }).getAttribute("href")).toMatch(/^#\/scan\/projects\/services-api-[a-z0-9]+$/);
    expect(screen.getByRole("region", { name: "Cross-project contributors" })).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("Grace Hopper")).toBeNull();
  });

  it("renders a useful empty state when no contributors are shared across projects", () => {
    render(<ScanOverview report={scanReportWithoutSharedContributors()} />);

    expect(screen.getByRole("heading", { name: "No shared contributors across projects" })).toBeTruthy();
    expect(screen.getByText(/appears in only one scanned repository/i)).toBeTruthy();
    expect(screen.queryByText("Grace Hopper")).toBeNull();
    expect(screen.queryByText("Katherine Johnson")).toBeNull();
  });

  it("renders scan aggregate AI usage and per-project AI usage columns", () => {
    render(<ScanOverview report={scanReportWithAiUsage()} />);

    expect(screen.getByText("Scan AI usage")).toBeTruthy();
    expect(screen.getByText("600")).toBeTruthy();
    expect(screen.getByText("$0.30")).toBeTruthy();
    expect(screen.getByText("AI total")).toBeTruthy();
    expect(screen.getByText("AI messages")).toBeTruthy();
    expect(screen.getByText("AI input")).toBeTruthy();
    expect(screen.getByText("AI output")).toBeTruthy();
    expect(screen.getByText("AI cache")).toBeTruthy();
    expect(screen.getAllByText("AI cost").length).toBeGreaterThan(0);
    expect(screen.getByRole("table", { name: "Client breakdown" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Model breakdown" })).toBeTruthy();
    expect(screen.getByText("pi-default")).toBeTruthy();
    expect(screen.getByText("claude-sonnet")).toBeTruthy();
    expect(screen.getAllByText("pi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("claude").length).toBeGreaterThan(0);
    expect(screen.getAllByText("400").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$0.25").length).toBeGreaterThan(0);
    expect(screen.queryByText("/workspace/services/api")).toBeNull();
  });

  it("explains empty scan results with scan scope guidance", () => {
    render(<ScanOverview report={emptyScanReport()} />);

    expect(screen.getByText("repositories")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No repositories matched this scan" })).toBeTruthy();
    expect(screen.getByText(/max depth, include patterns, and exclude patterns/i)).toBeTruthy();
  });

  it("renders a per-project drill-down with the shared repo route tabs", () => {
    const report = multiProjectScanReport();
    const entry = deriveScanProjectRouteEntries(report).at(0);

    if (!entry) {
      throw new Error("Expected scan fixture to include a project route entry");
    }

    render(<ScanProjectRoute report={report} projectSlug={entry.slug} />);

    expect(screen.getByRole("heading", { name: "api" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to scan overview" }).getAttribute("href")).toBe("#/scan");
    expect(screen.getByText("Commit streak")).toBeTruthy();
    expect(screen.getAllByText("Commit activity").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Charts" }));
    expect(screen.getByRole("heading", { name: "Charts" })).toBeTruthy();
    expect(screen.getByText("Cadence and churn")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quality" }));
    expect(screen.getByText("Repository health score")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Commits" }));
    expect(screen.getByRole("heading", { name: "Commits ledger" })).toBeTruthy();
  });

  it("renders per-project AI usage charts in scan project charts", () => {
    const report = scanReportWithAiUsage();
    const entry = deriveScanProjectRouteEntries(report).at(0);

    if (!entry) {
      throw new Error("Expected scan fixture to include a project route entry");
    }

    render(<ScanProjectRoute report={report} projectSlug={entry.slug} />);

    fireEvent.click(screen.getByRole("button", { name: "Charts" }));

    expect(screen.getByText("AI usage")).toBeTruthy();
    expect(screen.getByText("AI usage by model")).toBeTruthy();
    expect(screen.getByText("AI usage by harness")).toBeTruthy();
    expect(screen.getByText("pi-default")).toBeTruthy();
    expect(screen.getAllByText("pi").length).toBeGreaterThan(0);
  });

  it("renders per-project AI usage in the scan drill-down overview", () => {
    const report = scanReportWithAiUsage();
    const entry = deriveScanProjectRouteEntries(report).at(0);

    if (!entry) {
      throw new Error("Expected scan fixture to include a project route entry");
    }

    render(<ScanProjectRoute report={report} projectSlug={entry.slug} />);

    expect(screen.getByRole("heading", { name: "api" })).toBeTruthy();
    expect(screen.getByText("AI usage")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Client breakdown" })).toBeTruthy();
    expect(screen.getAllByText("pi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("400").length).toBeGreaterThan(0);
  });

  it("renders route mismatch states instead of crashing", () => {
    const { rerender } = render(<ScanOverview report={repoReportFixture} />);

    expect(screen.getByRole("heading", { name: "Scan overview is unavailable for repository reports" })).toBeTruthy();

    rerender(<ScanProjectRoute report={repoReportFixture} projectSlug="repo" />);

    expect(screen.getByRole("heading", { name: "Scan project drill-down is unavailable for repository reports" })).toBeTruthy();
  });

  it("derives stable project URL slugs that are safe for hash routes", () => {
    const report = multiProjectScanReport();
    const project = report.projects.at(1);

    if (!project) {
      throw new Error("Expected scan fixture to include a second project");
    }

    const firstSlug = deriveScanProjectSlug(project);
    const secondSlug = deriveScanProjectSlug(project);

    expect(firstSlug).toBe(secondSlug);
    expect(firstSlug).toMatch(/^apps-web-app-[a-z0-9]+$/);
    expect(firstSlug).not.toContain(" ");
    expect(firstSlug).not.toContain("/");
  });

  it("aggregates contributors by identity across projects", () => {
    const contributors = deriveCrossProjectContributors(multiProjectScanReport());
    const ada = contributors.find((contributor) => contributor.email === "ada@example.test");
    const grace = contributors.find((contributor) => contributor.email === "grace@example.test");

    expect(ada).toMatchObject({ name: "Ada Lovelace", projectCount: 2, commitCount: 3, additions: 28, deletions: 4 });
    expect(grace).toBeUndefined();
  });
});

describe("scan report shell navigation", () => {
  it("lands scan reports on scan overview and includes project links", async () => {
    const report = multiProjectScanReport();
    injectReport(report);
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/scan"));

    expect(await screen.findByRole("heading", { name: "Scan report", level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Scan Overview", current: "page" }).getAttribute("href")).toBe("#/scan");
    const navigation = screen.getByRole("navigation", { name: "Report sections" });
    expect(within(navigation).getByRole("link", { name: "api" }).getAttribute("href")).toBe(deriveScanProjectRouteEntries(report).at(0)?.href);
  });
});
