// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RepoReportData, ReportData } from "@git-snitch/core";

import { App } from "../src/app";
import { ChartsRoute } from "../src/charts-route";
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

function repoReportWithAiUsage(): RepoReportData {
  return {
    ...repoReportFixture,
    aiUsage: {
      records: 3,
      tokens: { input: 120, output: 80, cacheRead: 20, cacheWrite: 10, reasoning: 15, total: 245 },
      cost: 0.12,
      breakdowns: {
        byClient: [{ key: "opencode", records: 3, tokens: { input: 120, output: 80, cacheRead: 20, cacheWrite: 10, reasoning: 15, total: 245 }, cost: 0.12 }],
        byModel: [{ key: "gpt-5.5", records: 3, tokens: { input: 120, output: 80, cacheRead: 20, cacheWrite: 10, reasoning: 15, total: 245 }, cost: 0.12 }],
        byDay: [{ key: "2024-01-02", records: 3, tokens: { input: 120, output: 80, cacheRead: 20, cacheWrite: 10, reasoning: 15, total: 245 }, cost: 0.12 }],
      },
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

describe("charts route", () => {
  it("renders a purposeful chart sequence from repo data", () => {
    render(<ChartsRoute report={repoReportFixture} />);

    expect(screen.getByRole("heading", { name: "Charts" })).toBeTruthy();
    expect(screen.getByText("Commit activity")).toBeTruthy();
    expect(screen.getByText("Additions vs deletions")).toBeTruthy();
    expect(screen.getByText("Commit size distribution")).toBeTruthy();
    expect(screen.getByText("Time of day")).toBeTruthy();
    expect(screen.getByText("Language distribution")).toBeTruthy();
    expect(screen.getByText("Contribution calendar")).toBeTruthy();
    expect(screen.getByText("Velocity")).toBeTruthy();
    expect(screen.getByText("Code ownership")).toBeTruthy();
    expect(screen.getByText("Activity heatmap")).toBeTruthy();
    expect(screen.getByText("Weekly activity")).toBeTruthy();
  });

  it("renders repo-only mismatch for scan data without crashing", () => {
    render(<ChartsRoute report={scanReportFixture} />);

    expect(screen.getByRole("heading", { name: "Charts are unavailable for scan reports" })).toBeTruthy();
    expect(screen.getByText(/expects a single-repository report/i)).toBeTruthy();
  });

  it("renders explicit chart empty states for empty repositories", () => {
    render(<ChartsRoute report={emptyRepoReport()} />);

    expect(screen.getByRole("heading", { name: "This repository has no chartable activity yet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No commit activity to chart" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No line churn to chart" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No language distribution to chart" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No activity heatmap to show" })).toBeTruthy();
  });

  it("renders AI usage model and harness charts for repo data", () => {
    render(<ChartsRoute report={repoReportWithAiUsage()} />);

    expect(screen.getByText("AI usage")).toBeTruthy();
    expect(screen.getByText("AI usage by model")).toBeTruthy();
    expect(screen.getByText("AI usage by harness")).toBeTruthy();
    expect(screen.getByText("gpt-5.5")).toBeTruthy();
    expect(screen.getAllByText("opencode").length).toBeGreaterThan(0);
  });
});

describe("charts navigation", () => {
  it("enables the charts hash route from the report shell", async () => {
    injectReport(repoReportFixture);
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/overview"));

    const chartsLink = screen.getByRole("link", { name: "Charts" });
    expect(chartsLink.getAttribute("href")).toBe("#/charts");

    fireEvent.click(chartsLink);

    expect(await screen.findByRole("heading", { name: "Charts" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Charts", current: "page" })).toBeTruthy();
  });
});
