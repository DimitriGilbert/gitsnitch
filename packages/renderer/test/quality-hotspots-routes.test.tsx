// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { FileHotspot, QualitySignal, RepoReportData, ReportData } from "@git-snitch/core";

import { App } from "../src/app";
import { deriveHealthScore, HotspotsRoute, QualityRoute } from "../src/quality-hotspots-routes";
import { repoReportFixture, scanReportFixture } from "./report-fixtures";

function injectReport(report: ReportData) {
  Object.defineProperty(window, "__GIT_SNITCH_REPORT_DATA__", {
    configurable: true,
    value: report,
  });
}

function qualitySignals(): readonly QualitySignal[] {
  return [
    {
      id: "bus-factor-1",
      label: "Bus Factor",
      severity: "critical",
      value: 1,
      summary: "Only one contributor accounts for most commits. Distribute knowledge before releases depend on one person.",
    },
    {
      id: "commit-size-1",
      label: "Commit Size",
      severity: "warning",
      value: 420,
      summary: "Average commit size is large enough to make reviews slower and riskier.",
    },
  ];
}

function riskyHotspots(): readonly FileHotspot[] {
  return [
    {
      path: "src/risky-core.ts",
      changeCount: 14,
      additions: 900,
      deletions: 350,
      contributorCount: 3,
      contributors: ["Ada Lovelace", "Grace Hopper", "Katherine Johnson"],
      churn: 1_250,
      lastChangedAt: "2024-01-04T03:04:05.000Z",
      hotspotScore: 98,
      riskLevel: { level: "high", color: "red", emoji: "high" },
    },
    {
      path: "src/stable-shell.tsx",
      changeCount: 3,
      additions: 45,
      deletions: 8,
      contributorCount: 1,
      contributors: ["Ada Lovelace"],
      churn: 53,
      lastChangedAt: "2024-01-02T03:04:05.000Z",
      hotspotScore: 21,
      riskLevel: { level: "low", color: "green", emoji: "low" },
    },
  ];
}

function repoWithQuality(): RepoReportData {
  const secondCommit = {
    ...repoReportFixture.commits[0],
    hash: "abcdef1234567890",
    shortHash: "abcdef1",
    message: "fix: tighten renderer state",
  };
  const thirdCommit = {
    ...repoReportFixture.commits[0],
    hash: "fedcba0987654321",
    shortHash: "fedcba0",
    message: "refactor: split quality route",
    author: { name: "Grace Hopper", email: "grace@example.test" },
  };

  return {
    ...repoReportFixture,
    repository: { ...repoReportFixture.repository, totalCommits: 3, totalContributors: 2 },
    commits: [repoReportFixture.commits[0], secondCommit, thirdCommit],
    contributors: [
      { ...repoReportFixture.contributors[0], commitCount: 2 },
      {
        name: "Grace Hopper",
        email: "grace@example.test",
        commitCount: 1,
        additions: 12,
        deletions: 1,
        filesChanged: 1,
        firstCommitAt: "2024-01-02T03:04:05.000Z",
        lastCommitAt: "2024-01-02T03:04:05.000Z",
      },
    ],
    analysis: {
      ...repoReportFixture.analysis,
      hotspots: riskyHotspots(),
      qualitySignals: qualitySignals(),
    },
  };
}

function emptyRepoReport(): RepoReportData {
  return {
    ...repoReportFixture,
    repository: { ...repoReportFixture.repository, totalCommits: 0, totalContributors: 0 },
    commits: [],
    contributors: [],
    analysis: { ...repoReportFixture.analysis, hotspots: [], cadence: [], qualitySignals: [] },
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

describe("quality route", () => {
  it("renders a prominent health score, metric cards, and recommendations", () => {
    render(<QualityRoute report={repoWithQuality()} />);

    expect(screen.getByText("Repository health score")).toBeTruthy();
    expect(screen.getByText("54/100")).toBeTruthy();
    expect(screen.getByText("Strained")).toBeTruthy();
    expect(screen.getByText("Bus factor")).toBeTruthy();
    expect(screen.getByText("Avg commit size")).toBeTruthy();
    expect(screen.getByText("Churn")).toBeTruthy();
    expect(screen.getByText("Stability ratio")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recommendations" })).toBeTruthy();
    expect(screen.getByText("Only one contributor accounts for most commits. Distribute knowledge before releases depend on one person.")).toBeTruthy();
    expect(screen.getByText("Average commit size is large enough to make reviews slower and riskier.")).toBeTruthy();
  });

  it("renders repo-only mismatch for scan data without crashing", () => {
    render(<QualityRoute report={scanReportFixture} />);

    expect(screen.getByRole("heading", { name: "Quality is unavailable for scan reports" })).toBeTruthy();
    expect(screen.getByText(/expects a single-repository report/i)).toBeTruthy();
  });

  it("renders explicit empty and tiny repository states", () => {
    render(<QualityRoute report={emptyRepoReport()} />);

    expect(screen.getByText("Repository health score")).toBeTruthy();
    expect(screen.getByText("Unclear")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Quality evidence is sparse" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No quality recommendations yet" })).toBeTruthy();
  });

  it("treats a non-empty tiny repository as inconclusive instead of strong", () => {
    render(<QualityRoute report={repoReportFixture} />);

    expect(screen.getByText("Repository health score")).toBeTruthy();
    expect(screen.getByText("Unclear")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Quality evidence is sparse" })).toBeTruthy();
    expect(screen.getByText(/At least 3 commits and 2 contributors/i)).toBeTruthy();
    expect(screen.getByText(/not enough commits or contributors for a confident health label/i)).toBeTruthy();
    expect(screen.queryByText("Strong")).toBeNull();
    expect(deriveHealthScore(repoReportFixture)).toEqual({ score: 0, rating: "Unclear" });
  });

  it("derives lower health when critical recommendations and high-risk files are present", () => {
    expect(deriveHealthScore(repoWithQuality())).toEqual({ score: 54, rating: "Strained" });
  });
});

describe("hotspots route", () => {
  it("renders explanatory text, risk indicators, and the hotspots table", () => {
    render(<HotspotsRoute report={repoWithQuality()} />);

    expect(screen.getByRole("heading", { name: /Hotspots rank files where churn/i })).toBeTruthy();
    expect(screen.getByLabelText("Hotspot risk indicators")).toBeTruthy();
    expect(screen.getByText("High risk files")).toBeTruthy();
    expect(screen.getAllByText("src/risky-core.ts").length).toBeGreaterThan(1);
    expect(screen.getByRole("table", { name: "Hotspots table" })).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    expect(screen.getByText("low")).toBeTruthy();
  });

  it("renders repo-only mismatch for scan data without crashing", () => {
    render(<HotspotsRoute report={scanReportFixture} />);

    expect(screen.getByRole("heading", { name: "Hotspots are unavailable for scan reports" })).toBeTruthy();
    expect(screen.getByText(/expects a single-repository report/i)).toBeTruthy();
  });

  it("renders explicit empty state for repositories without ranked file churn", () => {
    render(<HotspotsRoute report={emptyRepoReport()} />);

    expect(screen.getByRole("heading", { name: /Hotspots rank files where churn/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No hotspots to show" })).toBeTruthy();
  });

  it("filters the HotspotsTable by file and contributor text", () => {
    render(<HotspotsRoute report={repoWithQuality()} />);

    fireEvent.change(screen.getByPlaceholderText("Search files or contributors"), { target: { value: "Grace" } });

    const table = screen.getByRole("table", { name: "Hotspots table" });
    expect(within(table).getByText("src/risky-core.ts")).toBeTruthy();
    expect(screen.queryByText("src/stable-shell.tsx")).toBeNull();
    expect(screen.getByText("1-1 of 1")).toBeTruthy();
  });
});

describe("quality and hotspots navigation", () => {
  it("enables quality and hotspots hash routes from the report shell", async () => {
    injectReport(repoWithQuality());
    render(<App />);

    await waitFor(() => expect(window.location.hash).toBe("#/overview"));

    const qualityLink = screen.getByRole("link", { name: "Quality" });
    const hotspotsLink = screen.getByRole("link", { name: "Hotspots" });
    expect(qualityLink.getAttribute("href")).toBe("#/quality");
    expect(hotspotsLink.getAttribute("href")).toBe("#/hotspots");

    fireEvent.click(qualityLink);
    expect(await screen.findByText("Repository health score")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Quality", current: "page" })).toBeTruthy();

    fireEvent.click(hotspotsLink);
    expect(await screen.findByRole("table", { name: "Hotspots table" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Hotspots", current: "page" })).toBeTruthy();
  });
});
