// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RepoReportData } from "@git-snitch/core";

import { App } from "../src/app";
import { RepoOverview, deriveStreakSummary } from "../src/overview";
import { repoReportFixture, scanReportFixture } from "./report-fixtures";

function injectReport(report: RepoReportData) {
  Object.defineProperty(window, "__GIT_SNITCH_REPORT_DATA__", {
    configurable: true,
    value: report,
  });
}

function emptyRepoReport(): RepoReportData {
  return {
    ...repoReportFixture,
    repository: { ...repoReportFixture.repository, totalCommits: 0, totalContributors: 0 },
    commits: [],
    contributors: [],
    analysis: { ...repoReportFixture.analysis, languages: [], hotspots: [], cadence: [], qualitySignals: [] },
  };
}

function repoReportWithAiUsage(): RepoReportData {
  return {
    ...repoReportFixture,
    aiUsage: {
      records: 3,
      tokens: { input: 100, output: 50, cacheRead: 25, cacheWrite: 10, reasoning: 15, total: 200 },
      cost: 0.1234,
      breakdowns: {
        byClient: [{ key: "opencode", records: 2, tokens: { input: 80, output: 40, cacheRead: 20, cacheWrite: 10, reasoning: 10, total: 160 }, cost: 0.1 }],
        byModel: [{ key: "gpt-5.5", records: 3, tokens: { input: 100, output: 50, cacheRead: 25, cacheWrite: 10, reasoning: 15, total: 200 }, cost: 0.1234 }],
        byDay: [{ key: "2024-01-02", records: 3, tokens: { input: 100, output: 50, cacheRead: 25, cacheWrite: 10, reasoning: 15, total: 200 }, cost: 0.1234 }],
      },
    },
  };
}

function repoReportWithZeroAiUsage(): RepoReportData {
  return {
    ...repoReportFixture,
    aiUsage: {
      records: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 },
      cost: 0,
      breakdowns: { byClient: [], byModel: [], byDay: [] },
    },
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

describe("repo overview route content", () => {
  it("renders repository totals, streaks, and a chart preview from repo data", () => {
    render(<RepoOverview report={repoReportFixture} />);

    expect(screen.getByText("Total commits")).toBeTruthy();
    expect(screen.getByText("Contributors")).toBeTruthy();
    expect(screen.getByText("Additions")).toBeTruthy();
    expect(screen.getByText("Deletions")).toBeTruthy();
    expect(screen.getByText("LoC")).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Commit streak")).toBeTruthy();
    expect(screen.getByText("Commit activity")).toBeTruthy();
  });

  it("renders an explicit empty repository state without hiding zero totals", () => {
    render(<RepoOverview report={emptyRepoReport()} />);

    expect(screen.getByText("Total commits")).toBeTruthy();
    expect(screen.getByText("Contributors")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "This repository has no commit activity yet" })).toBeTruthy();
    expect(screen.getByText(/there are no commits or contributors to summarize/i)).toBeTruthy();
  });

  it("renders a scan-data mismatch state for repo-only overview", () => {
    render(<RepoOverview report={scanReportFixture} />);

    expect(screen.getByRole("heading", { name: "Repo overview is unavailable for scan reports" })).toBeTruthy();
    expect(screen.getByText(/expects a single-repository report/i)).toBeTruthy();
  });

  it("renders repository AI usage totals and breakdowns when data exists", () => {
    render(<RepoOverview report={repoReportWithAiUsage()} />);

    expect(screen.getByText("AI usage")).toBeTruthy();
    expect(screen.getByText("Total tokens")).toBeTruthy();
    expect(screen.getAllByText("200").length).toBeGreaterThan(0);
    expect(screen.getByText("Estimated cost")).toBeTruthy();
    expect(screen.getAllByText("$0.1234").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Messages").length).toBeGreaterThan(0);
    expect(screen.getByText("opencode")).toBeTruthy();
    expect(screen.getByText("gpt-5.5")).toBeTruthy();
    expect(screen.queryByText("/workspace/fixture-repo")).toBeNull();
  });

  it("renders an explicit AI usage empty state when totals are zero", () => {
    render(<RepoOverview report={repoReportWithZeroAiUsage()} />);

    expect(screen.getByText("AI usage")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No AI usage matched this report" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Client breakdown unavailable" })).toBeTruthy();
  });

  it("derives current and longest streaks from consecutive commit dates", () => {
    const baseCommit = repoReportFixture.commits.at(0);

    if (!baseCommit) {
      throw new Error("Expected repo report fixture to include a commit");
    }

    const streak = deriveStreakSummary([
      { ...baseCommit, hash: "a", shortHash: "a", authoredAt: "2024-01-01T10:00:00.000Z" },
      { ...baseCommit, hash: "b", shortHash: "b", authoredAt: "2024-01-02T10:00:00.000Z" },
      { ...baseCommit, hash: "c", shortHash: "c", authoredAt: "2024-01-04T10:00:00.000Z" },
    ]);

    expect(streak).toEqual({ status: "ready", current: 1, longest: 2, anchorDate: "2024-01-04" });
  });
});

describe("root report shell navigation", () => {
  it("lands on overview and renders hash navigation inside the app shell", async () => {
    injectReport(repoReportFixture);
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/overview"));

    expect(await screen.findByRole("heading", { name: "fixture-repo", level: 1 })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Report sections" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Overview", current: "page" }).getAttribute("href")).toBe("#/overview");
    expect(screen.getByRole("link", { name: "Commits" }).getAttribute("href")).toBe("#/commits");
    expect(screen.getByText("Commit streak")).toBeTruthy();
  });
});
