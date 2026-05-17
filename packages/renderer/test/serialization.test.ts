import { describe, expect, it } from "vitest";

import type { RepoReportData } from "@git-snitch/core";

import { injectReportDataIntoHtml, REPORT_DATA_PLACEHOLDER, serializeReportDataForHtml } from "../src/serialization";

const reportWithScriptBreakingContent = {
  kind: "repo",
  generatedAt: "2026-01-02T03:04:05.000Z",
  repository: {
    name: "demo </script><img src=x>",
    path: "/tmp/demo",
    rootPath: "/tmp/demo",
    currentBranch: "main",
    totalCommits: 1,
    totalContributors: 1,
  },
  options: {
    repoPath: "/tmp/demo",
    branches: ["main"],
    allBranches: false,
    overwrite: true,
    open: false,
    format: "html",
  },
  commits: [
    {
      hash: "0123456789abcdef",
      shortHash: "0123456",
      message: "escape </script> <tag> & text \u2028 line \u2029 paragraph",
      author: { name: "A", email: "a@example.test" },
      authoredAt: "2026-01-02T03:04:05.000Z",
      committedAt: "2026-01-02T03:04:05.000Z",
      parents: [],
      refs: [],
      classification: "other",
      files: [],
    },
  ],
  contributors: [],
  analysis: {
    languages: [],
    hotspots: [],
    cadence: [],
    qualitySignals: [],
  },
} satisfies RepoReportData;

describe("report data HTML serialization", () => {
  it("escapes script-breaking and HTML-significant characters while preserving parseable JSON", () => {
    const serialized = serializeReportDataForHtml(reportWithScriptBreakingContent);

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<tag>");
    expect(serialized).not.toContain("&");
    expect(serialized).not.toContain("\u2028");
    expect(serialized).not.toContain("\u2029");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(serialized)).toEqual(reportWithScriptBreakingContent);
  });

  it("replaces exactly one quoted report-data placeholder with the safe serialized payload", () => {
    const template = `<script>window.__GIT_SNITCH_REPORT_DATA__ = ${JSON.stringify(REPORT_DATA_PLACEHOLDER)};</script>`;
    const html = injectReportDataIntoHtml(template, reportWithScriptBreakingContent);

    expect(html).not.toContain(JSON.stringify(REPORT_DATA_PLACEHOLDER));
    expect(html).toContain("window.__GIT_SNITCH_REPORT_DATA__ = {");
    expect(html).not.toContain("</script><img");
  });
});
