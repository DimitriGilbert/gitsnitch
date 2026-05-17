import { z } from "zod";

import type { IsoDateString } from "./json";

export const DEFAULT_SCAN_MAX_DEPTH = 3;

export const DEFAULT_SCAN_INCLUDE_PATTERNS = ["**/.git"] as const;

export const DEFAULT_SCAN_EXCLUDE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.turbo/**",
] as const;

const defaultScanOptions = {
  maxDepth: DEFAULT_SCAN_MAX_DEPTH,
  includePatterns: [...DEFAULT_SCAN_INCLUDE_PATTERNS],
  excludePatterns: [...DEFAULT_SCAN_EXCLUDE_PATTERNS],
};

export interface ReportOptions {
  readonly outputPath?: string;
  readonly overwrite: boolean;
  readonly open: boolean;
  readonly format: "html" | "json";
  readonly since?: IsoDateString;
  readonly until?: IsoDateString;
  readonly templatePath?: string;
}

export interface ScanOptions {
  readonly maxDepth: number;
  readonly includePatterns: readonly string[];
  readonly excludePatterns: readonly string[];
}

export interface RepoReportOptions extends ReportOptions {
  readonly repoPath: string;
  readonly branches: readonly string[];
  readonly allBranches: boolean;
}

export interface ScanReportOptions extends ReportOptions {
  readonly directory: string;
  readonly scan: ScanOptions;
}

export interface ScanPeriodOptions {
  readonly period?: string;
  readonly now?: IsoDateString;
}

export const isoDateStringSchema = z.string().refine(
  (value) => {
    const parsed = new Date(value);

    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
  },
  { message: "Expected an ISO 8601 UTC date string" },
);

const patternListSchema = z.array(z.string().min(1));

export const scanOptionsSchema = z.object({
  maxDepth: z.number().int().min(0).default(DEFAULT_SCAN_MAX_DEPTH),
  includePatterns: patternListSchema.default([...DEFAULT_SCAN_INCLUDE_PATTERNS]),
  excludePatterns: patternListSchema.default([...DEFAULT_SCAN_EXCLUDE_PATTERNS]),
});

const reportOptionsSchema = z.object({
  outputPath: z.string().min(1).optional(),
  overwrite: z.boolean().default(true),
  open: z.boolean().default(false),
  format: z.enum(["html", "json"]).default("html"),
  since: isoDateStringSchema.optional(),
  until: isoDateStringSchema.optional(),
  templatePath: z.string().min(1).optional(),
});

export const scanPeriodOptionsSchema = z.object({
  period: z.string().min(1).optional(),
  now: isoDateStringSchema.optional(),
});

export const repoReportOptionsObjectSchema = reportOptionsSchema.extend({
  repoPath: z.string().min(1),
  branches: z.array(z.string().min(1)).default([]),
  allBranches: z.boolean().default(false),
});

export const repoReportOptionsSchema = repoReportOptionsObjectSchema
  .refine((options) => !(options.allBranches && options.branches.length > 0), {
    message: "Use either explicit branches or allBranches, not both",
    path: ["branches"],
  });

export const scanReportOptionsSchema = reportOptionsSchema.extend({
  directory: z.string().min(1),
  scan: scanOptionsSchema.default(defaultScanOptions),
});
