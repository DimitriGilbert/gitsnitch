// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { readInjectedReportData, useIsRepoReport, useIsScanReport, useReportData } from "../src/data";
import { repoReportFixture, scanReportFixture } from "./report-fixtures";

function firstFixtureItem<T>(items: readonly T[], label: string): T {
  const item = items[0];

  if (item === undefined) {
    throw new Error(`Missing ${label} fixture item.`);
  }

  return item;
}

function expectInjectedPayloadToBeInvalid(payload: unknown) {
  window.__GIT_SNITCH_REPORT_DATA__ = payload;

  expect(readInjectedReportData().status).toBe("invalid");
}

const commitFixture = firstFixtureItem(repoReportFixture.commits, "commit");
const contributorFixture = firstFixtureItem(repoReportFixture.contributors, "contributor");
const languageFixture = firstFixtureItem(repoReportFixture.analysis.languages, "language");
const hotspotFixture = firstFixtureItem(repoReportFixture.analysis.hotspots, "hotspot");
const scanProjectFixture = firstFixtureItem(scanReportFixture.projects, "scan project");

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "__GIT_SNITCH_REPORT_DATA__");
});

function ReportProbe() {
  const state = useReportData();
  const report = state.status === "ready" ? state.report : null;
  const isRepo = useIsRepoReport(report);
  const isScan = useIsScanReport(report);

  return (
    <output aria-label="report status">
      {state.status}:{isRepo ? "repo" : "not-repo"}:{isScan ? "scan" : "not-scan"}
    </output>
  );
}

describe("renderer report data", () => {
  it("returns missing when standalone HTML has not received injected data", () => {
    expect(readInjectedReportData()).toEqual({ status: "missing" });
  });

  it("narrows valid repo report data through the hook", () => {
    window.__GIT_SNITCH_REPORT_DATA__ = repoReportFixture;

    render(<ReportProbe />);

    expect(screen.getByLabelText("report status").textContent).toBe("ready:repo:not-scan");
  });

  it("narrows valid scan report data through the hook", () => {
    window.__GIT_SNITCH_REPORT_DATA__ = scanReportFixture;

    render(<ReportProbe />);

    expect(screen.getByLabelText("report status").textContent).toBe("ready:not-repo:scan");
  });

  it("rejects a discriminated but incomplete report payload", () => {
    window.__GIT_SNITCH_REPORT_DATA__ = { kind: "repo", generatedAt: repoReportFixture.generatedAt, repository: { name: "partial" } };

    expect(readInjectedReportData()).toEqual({
      status: "invalid",
      reason: "Injected report data is missing required report sections.",
    });
  });

  it("rejects report payloads with invalid ISO dates", () => {
    expectInjectedPayloadToBeInvalid({ ...repoReportFixture, generatedAt: "not-an-iso-date" });
    expectInjectedPayloadToBeInvalid({
      ...repoReportFixture,
      commits: [{ ...commitFixture, authoredAt: "not-an-iso-date" }],
    });
  });

  it("rejects repo report payloads with missing repository fields", () => {
    expectInjectedPayloadToBeInvalid({
      ...repoReportFixture,
      repository: {
        name: repoReportFixture.repository.name,
        rootPath: repoReportFixture.repository.rootPath,
        currentBranch: repoReportFixture.repository.currentBranch,
        totalCommits: repoReportFixture.repository.totalCommits,
        totalContributors: repoReportFixture.repository.totalContributors,
      },
    });
  });

  it("rejects repo report payloads with malformed commit, contributor, and analysis array items", () => {
    expectInjectedPayloadToBeInvalid({
      ...repoReportFixture,
      commits: [{ ...commitFixture, files: [{ path: "src/index.ts", additions: -1, deletions: 0, status: "modified" }] }],
    });

    expectInjectedPayloadToBeInvalid({
      ...repoReportFixture,
      contributors: [{ ...contributorFixture, commitCount: -1 }],
    });

    expectInjectedPayloadToBeInvalid({
      ...repoReportFixture,
      analysis: {
        ...repoReportFixture.analysis,
        languages: [{ ...languageFixture, lines: -1 }],
        hotspots: [{ ...hotspotFixture, riskLevel: { level: "severe", color: "red", emoji: "critical" } }],
      },
    });
  });

  it("rejects scan report payloads with malformed project reports", () => {
    expectInjectedPayloadToBeInvalid({
      ...scanReportFixture,
      projects: [
        {
          ...scanProjectFixture,
          repository: { ...repoReportFixture.repository, relativePath: "fixture-repo" },
        },
      ],
    });

    expectInjectedPayloadToBeInvalid({
      ...scanReportFixture,
      projects: [{ ...scanProjectFixture, report: { ...repoReportFixture, commits: [{ ...commitFixture, committedAt: "not-an-iso-date" }] } }],
    });
  });

  it("renders on the server without touching browser globals", () => {
    const markup = renderToString(<ReportProbe />);

    expect(markup).toContain("missing");
    expect(markup).toContain("not-repo");
    expect(markup).toContain("not-scan");
  });
});
