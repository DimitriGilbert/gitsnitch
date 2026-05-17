import type { RepoReportData, ScanReportData } from "./report-data";

export type RepoTemplateRouteId = "overview" | "commits" | "contributors" | "charts" | "quality" | "hotspots";

export type ScanTemplateRouteId = "scanOverview" | "scanProject";

export type TemplateRouteId = RepoTemplateRouteId | ScanTemplateRouteId;

export interface TemplateExportHelpers {
  readonly downloadJson: (fileName: string) => void;
  readonly downloadCsv: (fileName: string, rows: readonly Record<string, string | number | boolean | null>[]) => void;
}

export interface RepoTemplateContext {
  readonly report: RepoReportData;
  readonly helpers: TemplateExportHelpers;
}

export interface ScanTemplateContext {
  readonly report: ScanReportData;
  readonly helpers: TemplateExportHelpers;
}

export interface ScanProjectTemplateContext extends ScanTemplateContext {
  readonly projectId: string;
}
