// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RepoReportData, ReportData } from "@git-snitch/core";

import { App } from "../src/app";
import { CommitsRoute, ContributorsRoute, deriveContributorTimelineSummary } from "../src/repo-routes";
import type { JsonDownloadResult } from "../src/repo-routes";
import { repoReportFixture, scanReportFixture } from "./report-fixtures";

function injectReport(report: ReportData) {
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

describe("commits route", () => {
  it("renders the full commits table with table search and export actions", () => {
    const jsonCalls: { readonly filename: string }[] = [];
    const jsonDownloader = (filename: string): JsonDownloadResult => {
      jsonCalls.push({ filename });
      return { status: "downloaded" };
    };

    render(<CommitsRoute report={repoReportFixture} jsonDownloader={jsonDownloader} />);

    expect(screen.getByRole("heading", { name: "Commits ledger" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Commits table" })).toBeTruthy();
    expect(screen.getByText("feat: add renderer fixture")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search commits, authors, files"), { target: { value: "missing" } });
    expect(screen.getAllByText("No matching rows").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Search commits, authors, files"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    expect(jsonCalls).toEqual([{ filename: "fixture-repo-commits.json" }]);
    expect(screen.getByText("JSON export started.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();
  });

  it("keeps commit table interactions responsive after sorting and pagination changes", () => {
    render(<CommitsRoute report={repoReportFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Authored" }));
    fireEvent.click(screen.getByRole("button", { name: "5 rows per page" }));
    fireEvent.change(screen.getByPlaceholderText("Search commits, authors, files"), { target: { value: "Ada" } });

    expect(screen.getByRole("table", { name: "Commits table" })).toBeTruthy();
    expect(screen.getByText(/1-\d+ of \d+/)).toBeTruthy();
  });

  it("renders repo-only mismatch and empty repository states explicitly", () => {
    const { rerender } = render(<CommitsRoute report={scanReportFixture} />);

    expect(screen.getByRole("heading", { name: "Commits are unavailable for scan reports" })).toBeTruthy();
    expect(screen.getByText(/single-repository report/i)).toBeTruthy();

    rerender(<CommitsRoute report={emptyRepoReport()} />);

    expect(screen.getByRole("heading", { name: "No commits to show" })).toBeTruthy();
    expect(screen.getByText(/selected repository and branch scope/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Export JSON" })).toBeNull();
  });
});

describe("contributors route", () => {
  it("renders contributors table, comparison visuals, timeline summary, and export actions", () => {
    const jsonCalls: { readonly filename: string }[] = [];
    const jsonDownloader = (filename: string): JsonDownloadResult => {
      jsonCalls.push({ filename });
      return { status: "downloaded" };
    };

    render(<ContributorsRoute report={repoReportFixture} jsonDownloader={jsonDownloader} />);

    expect(screen.getByRole("heading", { name: "Contributors" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Contributors table" })).toBeTruthy();
    expect(screen.getByText("Contributor share")).toBeTruthy();
    expect(screen.getByText("Code ownership")).toBeTruthy();
    expect(screen.getByText("Activity span")).toBeTruthy();
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    expect(jsonCalls).toEqual([{ filename: "fixture-repo-contributors.json" }]);
    expect(screen.getByText("JSON export started.")).toBeTruthy();
  });

  it("renders repo-only mismatch and contributor empty states explicitly", () => {
    const { rerender } = render(<ContributorsRoute report={scanReportFixture} />);

    expect(screen.getByRole("heading", { name: "Contributors are unavailable for scan reports" })).toBeTruthy();

    rerender(<ContributorsRoute report={emptyRepoReport()} />);

    expect(screen.getByRole("heading", { name: "No contributors to show" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No contributor comparison yet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No contributor timeline yet" })).toBeTruthy();
  });

  it("derives timeline summary from valid contributor dates", () => {
    expect(deriveContributorTimelineSummary(repoReportFixture.contributors)).toEqual({
      status: "ready",
      firstDate: "2024-01-02",
      lastDate: "2024-01-02",
      activeDays: 1,
      latestContributor: "Ada Lovelace",
    });
  });
});

describe("route navigation", () => {
  it("enables commits and contributors hash routes from the report shell", async () => {
    injectReport(repoReportFixture);
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/overview"));

    const commitsLink = screen.getByRole("link", { name: "Commits" });
    const contributorsLink = screen.getByRole("link", { name: "Contributors" });

    expect(commitsLink.getAttribute("href")).toBe("#/commits");
    expect(contributorsLink.getAttribute("href")).toBe("#/contributors");

    fireEvent.click(commitsLink);
    expect(await screen.findByRole("heading", { name: "Commits ledger" })).toBeTruthy();

    fireEvent.click(contributorsLink);
    expect(await screen.findByRole("heading", { name: "Contributors" })).toBeTruthy();
  });
});
