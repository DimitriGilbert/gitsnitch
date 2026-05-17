import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

export interface GitSnitchConfigOverrides {
  readonly repo?: Partial<GitSnitchConfig["repo"]>;
  readonly scan?: Partial<GitSnitchConfig["scan"]>;
  readonly report?: Partial<GitSnitchConfig["report"]>;
}

export class GitSnitchConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "GitSnitchConfigError";
  }
}

export async function loadGitSnitchConfig(baseDir: string): Promise<GitSnitchConfig> {
  const configPath = join(baseDir, ".git-snitch", "config.json");
  let raw: string;

  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return getDefaultGitSnitchConfig();
    }
    throw new GitSnitchConfigError(`Unable to read ${configPath}: ${errorMessage(error)}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new GitSnitchConfigError(`Invalid JSON in ${configPath}: ${errorMessage(error)}`);
  }

  const parsed = gitSnitchConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new GitSnitchConfigError(`Invalid git-snitch config at ${configPath}: ${formatZodError(parsed.error)}`);
  }

  return parsed.data;
}

export function getDefaultGitSnitchConfig(): GitSnitchConfig {
  return gitSnitchConfigSchema.parse({});
}

export function mergeGitSnitchConfig(
  base: GitSnitchConfig = getDefaultGitSnitchConfig(),
  overrides: GitSnitchConfigOverrides = {},
): GitSnitchConfig {
  const merged = {
    repo: {
      ...base.repo,
      ...definedProperties(overrides.repo),
    },
    scan: {
      ...base.scan,
      ...definedProperties(overrides.scan),
      excludePatterns: mergePatternAdditions(base.scan.excludePatterns, overrides.scan?.excludePatterns),
      includePatterns: overrides.scan?.includePatterns ?? base.scan.includePatterns,
    },
    report: {
      ...base.report,
      ...definedProperties(overrides.report),
    },
  };

  const parsed = gitSnitchConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new GitSnitchConfigError(`Invalid git-snitch config overrides: ${formatZodError(parsed.error)}`);
  }

  return parsed.data;
}

function mergePatternAdditions(base: readonly string[], additions: readonly string[] | undefined): readonly string[] {
  if (additions === undefined) {
    return base;
  }
  return [...new Set([...base, ...additions])];
}

function definedProperties<T extends object>(value: T | undefined): Partial<T> {
  if (value === undefined) {
    return {};
  }

  const result: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    const propertyValue = value[key];
    if (propertyValue !== undefined) {
      result[key] = propertyValue;
    }
  }
  return result;
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`).join("; ");
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === code;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
