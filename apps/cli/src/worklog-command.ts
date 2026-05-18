import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  generateWorklog,
  isRepoReportData,
  isScanReportData,
} from "@git-snitch/core";

import type { ReportData, WorklogOptions, WorklogResult } from "@git-snitch/core";

import type { CliDependencies } from "./index.js";

export interface WorklogCommandOptions {
  readonly output?: string;
  readonly prompt?: string;
  readonly harness?: string;
  readonly executor?: string;
  readonly e?: string;
  readonly model?: string;
  readonly skill?: string;
}

export async function runWorklogCommand(
  exportFilePath: string,
  options: WorklogCommandOptions,
  dependencies: Required<CliDependencies>,
): Promise<void> {
  const resolvedPath = resolve(exportFilePath);

  let raw: string;
  try {
    raw = await readFile(resolvedPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read export file ${resolvedPath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Export file ${resolvedPath} does not contain valid JSON.`);
  }

  if (!isRepoReportData(parsed) && !isScanReportData(parsed)) {
    throw new Error(`Export file ${resolvedPath} does not contain valid git-snitch report data.`);
  }

  const report = parsed as ReportData;
  const resolvedHarness = options.harness ?? "opencode";

  const worklogOptions: WorklogOptions = {
    prompt: options.prompt,
    harness: resolvedHarness as WorklogOptions["harness"],
    model: options.model,
    skill: options.skill as WorklogOptions["skill"],
  };

  const result: WorklogResult = await generateWorklog(report, worklogOptions);

  const outputPath = options.output
    ? resolve(options.output)
    : deriveDefaultOutputPath(resolvedPath);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.markdown, "utf8");
  dependencies.io.stdout(`Wrote worklog ${outputPath}\n`);
}

function deriveDefaultOutputPath(inputPath: string): string {
  const withoutExtension = inputPath.replace(/\.json$/i, "");
  return `${withoutExtension}-worklog.md`;
}
