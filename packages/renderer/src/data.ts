import type { ReportData } from "@git-snitch/core";

declare global {
  interface Window {
    readonly __GIT_SNITCH_REPORT_DATA__?: unknown;
  }
}

export type ReportDataState =
  | { readonly status: "ready"; readonly report: ReportData }
  | { readonly status: "missing" }
  | { readonly status: "invalid"; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMinimalRepoReportData(value: unknown): value is ReportData {
  if (!isRecord(value) || value.kind !== "repo" || typeof value.generatedAt !== "string") {
    return false;
  }

  return isRecord(value.repository) && typeof value.repository.name === "string";
}

function isMinimalScanReportData(value: unknown): value is ReportData {
  return isRecord(value) && value.kind === "scan" && typeof value.generatedAt === "string" && typeof value.directory === "string";
}

export function readInjectedReportData(): ReportDataState {
  const candidate = window.__GIT_SNITCH_REPORT_DATA__;

  if (candidate === undefined || typeof candidate === "string") {
    return { status: "missing" };
  }

  if (isMinimalRepoReportData(candidate) || isMinimalScanReportData(candidate)) {
    return { status: "ready", report: candidate };
  }

  return { status: "invalid", reason: "Injected report data does not match the git-snitch report contract." };
}
