// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadCsv, downloadJson, downloadTextFile, serializeCsv, serializeReportJson } from "../src/export";
import { repoReportFixture } from "./report-fixtures";

const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();

  if (originalCreateObjectUrl) {
    Object.defineProperty(URL, "createObjectURL", originalCreateObjectUrl);
  }

  if (originalRevokeObjectUrl) {
    Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectUrl);
  }
});

function installDownloadApis() {
  const createObjectURL = vi.fn(() => "blob:git-snitch-report");
  const revokeObjectURL = vi.fn();

  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

  return { createObjectURL, revokeObjectURL };
}

describe("renderer export helpers", () => {
  it("serializes CSV headers, rows, and quoted cells deterministically", () => {
    const csv = serializeCsv(
      [
        { name: "Ada", commits: 2, note: "compiler, math" },
        { name: "Grace", commits: 3, note: "quote \"inside\"" },
      ],
      ["name", "commits", "note"],
    );

    expect(csv).toBe('name,commits,note\nAda,2,"compiler, math"\nGrace,3,"quote ""inside"""');
  });

  it("serializes report JSON with readable indentation", () => {
    const json = serializeReportJson(repoReportFixture);

    expect(json).toContain('\n  "kind": "repo"');
    expect(JSON.parse(json)).toMatchObject({ kind: "repo", repository: { name: "fixture-repo" } });
  });

  it("downloads text content with browser Blob URLs and cleans up the temporary link", () => {
    const { createObjectURL, revokeObjectURL } = installDownloadApis();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const result = downloadTextFile("report.csv", "name\nAda", "text/csv;charset=utf-8");

    expect(result).toEqual({ status: "downloaded" });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:git-snitch-report");
    expect(document.body.querySelector("a")).toBeNull();
  });

  it("guards downloads when standalone browser APIs are unavailable", () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: undefined });

    expect(downloadCsv("report.csv", [{ name: "Ada" }])).toEqual({
      status: "unavailable",
      reason: "Browser download APIs are not available in this environment.",
    });
  });

  it("uses CSV and JSON serializers for download helpers", () => {
    installDownloadApis();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    expect(downloadCsv("contributors.csv", [{ name: "Ada" }])).toEqual({ status: "downloaded" });
    expect(downloadJson("report.json", repoReportFixture)).toEqual({ status: "downloaded" });
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });
});
