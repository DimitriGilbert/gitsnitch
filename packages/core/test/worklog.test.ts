import { describe, expect, it } from "vitest";

import type { RepoReportData } from "../src/index";

import {
  buildWorklogPrompt,
  createHarness,
  renderWorklogHtml,
  resolveSkillPrompt,
  worklogOptionsSchema,
} from "../src/index";

function makeMinimalRepoReport(): RepoReportData {
  return {
    kind: "repo",
    generatedAt: "2024-01-02T03:04:05.000Z",
    repository: {
      name: "test-repo",
      path: "/workspace/test-repo",
      rootPath: "/workspace/test-repo",
      totalCommits: 1,
      totalContributors: 1,
    },
    options: {
      overwrite: true,
      open: false,
      format: "html",
      repoPath: "/workspace/test-repo",
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
  };
}

describe("worklogOptionsSchema", () => {
  it("validates defaults with harness opencode", () => {
    const result = worklogOptionsSchema.parse({});

    expect(result.harness).toBe("opencode");
    expect(result.prompt).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.skill).toBeUndefined();
    expect(result.outputPath).toBeUndefined();
  });

  it("rejects invalid harness", () => {
    const result = worklogOptionsSchema.safeParse({ harness: "invalid" });

    expect(result.success).toBe(false);
  });

  it("accepts all valid harness values", () => {
    for (const harness of ["opencode", "pi", "codex"] as const) {
      const result = worklogOptionsSchema.safeParse({ harness });
      expect(result.success).toBe(true);
    }
  });
});

describe("buildWorklogPrompt", () => {
  it("interpolates report data into the prompt", () => {
    const report = makeMinimalRepoReport();
    const prompt = buildWorklogPrompt(report);

    expect(prompt).toContain("test-repo");
    expect(prompt).toContain("Report data:");
    expect(prompt).toContain("```json");
  });

  it("uses custom prompt when provided", () => {
    const report = makeMinimalRepoReport();
    const prompt = buildWorklogPrompt(report, "Summarize this project.");

    expect(prompt).toContain("Summarize this project.");
    expect(prompt).toContain("Report data:");
  });

  it("uses default template when no custom prompt", () => {
    const report = makeMinimalRepoReport();
    const prompt = buildWorklogPrompt(report);

    expect(prompt).toContain("Generate a work log");
    expect(prompt).toContain("Report data:");
  });
});

describe("resolveSkillPrompt", () => {
  it("returns user prompt when provided", () => {
    const result = resolveSkillPrompt(undefined, "Custom user prompt");

    expect(result).toBe("Custom user prompt");
  });

  it("returns skill default when skill provided and no user prompt", () => {
    const result = resolveSkillPrompt("changelog", undefined);

    expect(result).toContain("Keep a Changelog");
  });

  it("returns work-log default when neither skill nor user prompt", () => {
    const result = resolveSkillPrompt(undefined, undefined);

    expect(result).toContain("work log");
  });

  it("returns work-log default for unrecognized skill name", () => {
    const result = resolveSkillPrompt("unknown-skill" as never, undefined);

    expect(result).toContain("work log");
  });
});

describe("createHarness", () => {
  it("returns valid harness for opencode", () => {
    const harness = createHarness("opencode");

    expect(harness.name).toBe("opencode");
    expect(typeof harness.generate).toBe("function");
  });

  it("throws not yet implemented for pi harness", async () => {
    const harness = createHarness("pi");

    await expect(harness.generate("test", {})).rejects.toThrow("not yet implemented");
  });

  it("throws not yet implemented for codex harness", async () => {
    const harness = createHarness("codex");

    await expect(harness.generate("test", {})).rejects.toThrow("not yet implemented");
  });

  it("throws for invalid harness name", () => {
    expect(() => createHarness("invalid" as never)).toThrow();
  });
});

describe("renderWorklogHtml", () => {
  it("returns valid HTML with expected structure", () => {
    const html = renderWorklogHtml({
      markdown: "# Test Heading\n\nParagraph text.",
      harness: "opencode",
      model: "default",
      generatedAt: "2024-06-15T12:00:00.000Z",
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain("<title>git-snitch worklog</title>");
    expect(html).toContain('<main class="markdown-body">');
    expect(html).toContain("<h1");
    expect(html).toContain("Test Heading");
    expect(html).toContain("<p>Paragraph text.</p>");
  });

  it("includes metadata in the header", () => {
    const html = renderWorklogHtml({
      markdown: "Content",
      harness: "opencode",
      model: "gpt-4",
      generatedAt: "2024-06-15T12:00:00.000Z",
    });

    expect(html).toContain("Generated 2024-06-15T12:00:00.000Z using opencode/gpt-4");
    expect(html).toContain("<h1>Worklog</h1>");
  });
});
