import type { JsonValue, ReportData } from "@git-snitch/core";

export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = Readonly<Record<string, CsvCell>>;

export type DownloadResult =
  | { readonly status: "downloaded" }
  | { readonly status: "unavailable"; readonly reason: string };

const JSON_INDENT = 2;

function hasBrowserDownloadApis(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    typeof URL.revokeObjectURL === "function"
  );
}

function escapeCsvCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) {
    return "";
  }

  const value = String(cell);
  const escaped = value.replaceAll('"', '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function serializeCsv(rows: readonly CsvRow[], columns?: readonly string[]): string {
  const resolvedColumns = columns ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  if (resolvedColumns.length === 0) {
    return "";
  }

  const header = resolvedColumns.map(escapeCsvCell).join(",");
  const body = rows.map((row) => resolvedColumns.map((column) => escapeCsvCell(row[column])).join(","));
  return [header, ...body].join("\n");
}

export function serializeReportJson(report: ReportData | JsonValue): string {
  return JSON.stringify(report, null, JSON_INDENT);
}

export function downloadTextFile(filename: string, content: string, mimeType: string): DownloadResult {
  if (!hasBrowserDownloadApis()) {
    return { status: "unavailable", reason: "Browser download APIs are not available in this environment." };
  }

  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return { status: "downloaded" };
}

export function downloadCsv(filename: string, rows: readonly CsvRow[], columns?: readonly string[]): DownloadResult {
  const csv = serializeCsv(rows, columns);
  return downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}

export function downloadJson(filename: string, report: ReportData | JsonValue): DownloadResult {
  const json = serializeReportJson(report);
  return downloadTextFile(filename, json, "application/json;charset=utf-8");
}
