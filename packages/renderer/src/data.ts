import { useMemo } from "react";
import { isRepoReportData, isScanReportData, reportDataDiscriminantSchema } from "@git-snitch/core/report-data";
import type { RepoReportData, ReportData, ScanReportData } from "@git-snitch/core";

declare global {
  interface Window {
    readonly __GIT_SNITCH_REPORT_DATA__?: unknown;
  }
}

export type ReportDataState =
  | { readonly status: "ready"; readonly report: ReportData }
  | { readonly status: "missing" }
  | { readonly status: "invalid"; readonly reason: string };

export function readInjectedReportData(): ReportDataState {
  if (typeof window === "undefined") {
    return { status: "missing" };
  }

  const candidate = window.__GIT_SNITCH_REPORT_DATA__;

  if (candidate === undefined || typeof candidate === "string") {
    return { status: "missing" };
  }

  if (isRepoReportData(candidate) || isScanReportData(candidate)) {
    return { status: "ready", report: candidate };
  }

  if (reportDataDiscriminantSchema.safeParse(candidate).success) {
    return { status: "invalid", reason: "Injected report data is missing required report sections." };
  }

  return { status: "invalid", reason: "Injected report data does not match the git-snitch report contract." };
}

export function isReadyReportData(state: ReportDataState): state is { readonly status: "ready"; readonly report: ReportData } {
  return state.status === "ready";
}

export function useReportData(): ReportDataState {
  return useMemo(() => readInjectedReportData(), []);
}

export function useIsRepoReport(report: ReportData | null | undefined): report is RepoReportData {
  return Boolean(report && report.kind === "repo");
}

export function useIsScanReport(report: ReportData | null | undefined): report is ScanReportData {
  return Boolean(report && report.kind === "scan");
}
