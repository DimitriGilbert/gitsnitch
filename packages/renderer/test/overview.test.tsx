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
