import { z } from "zod";

import {
  DEFAULT_SCAN_EXCLUDE_PATTERNS,
  DEFAULT_SCAN_INCLUDE_PATTERNS,
  DEFAULT_SCAN_MAX_DEPTH,
  repoReportOptionsObjectSchema,
  scanOptionsSchema,
} from "./options";

const defaultScanConfig = {
  maxDepth: DEFAULT_SCAN_MAX_DEPTH,
  includePatterns: [...DEFAULT_SCAN_INCLUDE_PATTERNS],
  excludePatterns: [...DEFAULT_SCAN_EXCLUDE_PATTERNS],
};

const defaultReportConfig = {
  overwrite: true,
  open: false,
  format: "html" as const,
};

export const gitSnitchConfigSchema = z
  .object({
    repo: repoReportOptionsObjectSchema.omit({ repoPath: true }).partial().default({}),
    scan: scanOptionsSchema.default(defaultScanConfig),
    report: z
      .object({
        outputPath: z.string().min(1).optional(),
        overwrite: z.boolean().default(true),
        open: z.boolean().default(false),
        format: z.enum(["html", "json"]).default("html"),
        templatePath: z.string().min(1).optional(),
      })
      .default(defaultReportConfig),
  })
  .default({ repo: {}, scan: defaultScanConfig, report: defaultReportConfig });

export type GitSnitchConfig = z.infer<typeof gitSnitchConfigSchema>;
