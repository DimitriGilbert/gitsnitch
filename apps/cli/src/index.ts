#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

import { Command, InvalidArgumentError } from "commander";
import {
  anonymizeReport,
  generateRepoReport,
  generateScanReport,
  generateWorklog,
  loadGitSnitchConfig,
  mergeGitSnitchConfig,
  renderWorklogHtml,
  worklogOptionsSchema,
} from "@git-snitch/core";
import { buildStandaloneReportHtml } from "@git-snitch/renderer/build";

import { runWorklogCommand } from "./worklog-command.js";

import type { AnonOptions, GitSnitchConfigOverrides, RepoReportOptions, ScanOptions, WorklogOptions } from "@git-snitch/core";

export interface PackageMetadata {
  readonly name: "@git-snitch/cli";
  readonly role: "cli";
  readonly version: "0.0.0";
}

export const cliPackageMetadata = {
  name: "@git-snitch/cli",
  role: "cli",
  version: "0.0.0",
} satisfies PackageMetadata;

export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export type CliOpener = (filePath: string) => Promise<void>;

export interface CliDependencies {
  readonly io?: CliIo;
  readonly opener?: CliOpener;
}

interface SharedCommandOptions {
  readonly output?: string;
  readonly json?: boolean;
  readonly open?: boolean;
  readonly overwrite?: boolean;
  readonly template?: string;
  readonly since?: string;
  readonly until?: string;
  readonly anon?: boolean;
  readonly hideNames?: boolean;
  readonly hideEmails?: boolean;
  readonly hidePaths?: boolean;
  readonly hideUrls?: boolean;
  readonly hashCommits?: boolean;
  readonly hideMessages?: boolean;
  readonly obfuscateKey?: string;
  readonly github?: boolean;
}

interface RepoCommandOptions extends SharedCommandOptions {
  readonly branch?: readonly string[];
  readonly allBranches?: boolean;
}

interface ScanCommandOptions extends SharedCommandOptions {
  readonly period?: string;
  readonly maxDepth?: number;
  readonly exclude?: readonly string[];
}

export function createProgram(dependencies: CliDependencies = {}): Command {
  const program = new Command();
  const io = dependencies.io ?? defaultIo;
  const opener = dependencies.opener ?? openFile;

  program
    .name("git-snitch")
    .description("Generate standalone git activity reports.")
    .version(cliPackageMetadata.version)
    .exitOverride()
    .configureOutput({
      writeOut: (text) => io.stdout(text),
      writeErr: (text) => io.stderr(text),
    });

  program
    .command("repo")
    .description("Generate a standalone report for one git repository.")
    .argument("[repoPath]", "Repository path", ".")
    .option("-o, --output <path>", "Output file path")
    .option("--json", "Print report JSON instead of writing HTML")
    .option("--open", "Open the generated HTML report")
    .option("--no-overwrite", "Fail if the output file already exists")
    .option("--template <path>", "TSX module exporting route-level template overrides")
    .option("--since <iso>", "Only include commits since an ISO 8601 UTC date")
    .option("--until <iso>", "Only include commits until an ISO 8601 UTC date")
    .option("--branch <ref>", "Branch or ref to include", collectValues, [])
    .option("--all-branches", "Include local and remote refs")
    .option("--anon", "Enable full anonymization (shorthand for all --hide-* flags)")
    .option("--hide-names", "Replace author/contributor names with pseudonyms")
    .option("--hide-emails", "Replace emails with pseudonyms")
    .option("--hide-paths", "Hash file paths")
    .option("--hide-urls", "Remove remote URLs")
    .option("--hash-commits", "Replace commit hashes")
    .option("--hide-messages", "Replace commit messages with classification")
    .option("--obfuscate-key <string>", "Secret key for deterministic hashing")
    .option("--no-github", "Skip GitHub API calls")
    .option("--worklog-prompt <string>", "Override default AI prompt for worklog generation")
    .option("--worklog-harness <string>", "AI harness: opencode, pi, codex", parseHarnessOption)
    .option("--worklog-model <string>", "Override default model for the AI harness")
    .option("--worklog-skill <string>", "AI skill for the harness", parseSkillOption)
    .action(async (repoPath: string, options: RepoCommandOptions, command: Command) => {
      await runRepoCommand(repoPath, normalizeRepoCommandOptions(options, command), { io, opener });
    });

  program
    .command("scan")
    .description("Generate a standalone report for multiple discovered git repositories.")
    .argument("[dir]", "Directory to scan", ".")
    .option("-o, --output <path>", "Output file path")
    .option("--json", "Print report JSON instead of writing HTML")
    .option("--open", "Open the generated HTML report")
    .option("--no-overwrite", "Fail if the output file already exists")
    .option("--template <path>", "TSX module exporting route-level template overrides")
    .option("--since <iso>", "Only include commits since an ISO 8601 UTC date")
    .option("--until <iso>", "Only include commits until an ISO 8601 UTC date")
    .option("--period <duration>", "Scan period such as 7d, 4w, 3m, or 1y")
    .option("--max-depth <number>", "Maximum recursive discovery depth", parseNonNegativeInteger)
    .option("--exclude <pattern>", "Additional directory glob to exclude", collectValues, [])
    .option("--anon", "Enable full anonymization (shorthand for all --hide-* flags)")
    .option("--hide-names", "Replace author/contributor names with pseudonyms")
    .option("--hide-emails", "Replace emails with pseudonyms")
    .option("--hide-paths", "Hash file paths")
    .option("--hide-urls", "Remove remote URLs")
    .option("--hash-commits", "Replace commit hashes")
    .option("--hide-messages", "Replace commit messages with classification")
    .option("--obfuscate-key <string>", "Secret key for deterministic hashing")
    .option("--no-github", "Skip GitHub API calls")
    .option("--worklog-prompt <string>", "Override default AI prompt for worklog generation")
    .option("--worklog-harness <string>", "AI harness: opencode, pi, codex", parseHarnessOption)
    .option("--worklog-model <string>", "Override default model for the AI harness")
    .option("--worklog-skill <string>", "AI skill for the harness", parseSkillOption)
    .option("--worklog-output <path>", "Output file path for the worklog document")
    .action(async (directory: string, options: ScanCommandOptions, command: Command) => {
      await runScanCommand(directory, normalizeOverwriteOption(options, command), { io, opener });
    });

  program
    .command("worklog")
    .description("Generate an AI-powered work log from a git-snitch export file.")
    .argument("<exportFile>", "Path to a git-snitch JSON export file")
    .option("-o, --output <path>", "Output file path for the generated work log")
    .option("--prompt <text>", "Override the default AI prompt")
    .option("--harness <kind>", "AI harness to use", parseHarnessOption)
    .option("--executor <kind>", "Alias for --harness", parseHarnessOption)
    .option("-e <kind>", "Alias for --harness", parseHarnessOption)
    .option("--model <name>", "Override the default AI model")
    .option("--skill <name>", "Skill template to use", parseSkillOption)
    .action(async (exportFile: string, options: Record<string, unknown>) => {
      const resolvedHarness = (options.harness ?? options.executor ?? options.e ?? "opencode") as string;
      await runWorklogCommand(
        exportFile,
        {
          output: options.output as string | undefined,
          prompt: options.prompt as string | undefined,
          harness: resolvedHarness,
          executor: undefined,
          e: undefined,
          model: options.model as string | undefined,
          skill: options.skill as string | undefined,
        },
        { io, opener },
      );
    });

  return program;
}

export async function runCli(argv: readonly string[], dependencies: CliDependencies = {}): Promise<number> {
  try {
    const rewritten = rewriteWorklogAliases(argv);
    await createProgram(dependencies).parseAsync(["node", "git-snitch", ...rewritten], { from: "node" });
    return 0;
  } catch (error) {
    const io = dependencies.io ?? defaultIo;
    if (isCommanderHelpOrVersion(error)) {
      return 0;
    }
    io.stderr(`${formatCliError(error)}\n`);
    return 1;
  }
}

async function runRepoCommand(repoPath: string, options: RepoCommandOptions, dependencies: Required<CliDependencies>): Promise<void> {
  const resolvedRepoPath = resolve(repoPath);
  const config = mergeGitSnitchConfig(await loadGitSnitchConfig(resolvedRepoPath), buildSharedOverrides(options));
  const shouldOpenReport = options.open === true;
  const branches = options.branch ?? config.repo.branches ?? [];
  const allBranches = options.allBranches ?? config.repo.allBranches ?? false;
  if (allBranches && branches.length > 0) {
    throw new Error("Invalid branch options: use either --branch or --all-branches, not both.");
  }

  const reportOptions: RepoReportOptions = {
    outputPath: options.output ?? config.report.outputPath,
    overwrite: options.overwrite ?? config.report.overwrite,
    open: shouldOpenReport,
    format: options.json ? "json" : config.report.format,
    since: options.since ?? config.repo.since,
    until: options.until ?? config.repo.until,
    templatePath: options.template ?? config.report.templatePath,
    anon: config.anon,
    noGitHub: config.noGitHub,
    repoPath: resolvedRepoPath,
    branches,
    allBranches,
  };

  const report = await generateRepoReport(reportOptions, { noGitHub: config.noGitHub });

  let finalReport = report;
  if (config.anon !== undefined) {
    const { report: anonReport, meta } = anonymizeReport(report, config.anon);
    if (anonReport.kind === "repo") {
      finalReport = { ...anonReport, anonymization: meta };
    }
  }

  const worklogOpts = resolveWorklogOptions(options as Record<string, unknown>, config.worklog);
  if (worklogOpts !== undefined) {
    if (options.json) {
      dependencies.io.stderr("Warning: Both --json and worklog options provided. Worklog output takes precedence.\n");
    }
    const result = await generateWorklog(finalReport, worklogOpts);
    const html = renderWorklogHtml(result);
    const worklogPath = resolve(
      worklogOpts.outputPath ?? deterministicWorklogPath("repo", finalReport.repository.name),
    );
    await mkdir(dirname(worklogPath), { recursive: true });
    await writeFile(worklogPath, html, "utf8");
    dependencies.io.stdout(`Wrote worklog ${worklogPath}\n`);
    if (shouldOpenReport) {
      await dependencies.opener(worklogPath);
    }
    return;
  }

  if (reportOptions.format === "json") {
    dependencies.io.stdout(`${JSON.stringify(finalReport, null, 2)}\n`);
    return;
  }

  const outputPath = resolve(reportOptions.outputPath ?? deterministicOutputPath("repo", finalReport.repository.name));
  await writeHtmlReport({ outputPath, overwrite: reportOptions.overwrite, templatePath: reportOptions.templatePath, report: finalReport });
  dependencies.io.stdout(`Wrote ${outputPath}\n`);
  if (shouldOpenReport) {
    await dependencies.opener(outputPath);
  }
}

async function runScanCommand(directory: string, options: ScanCommandOptions, dependencies: Required<CliDependencies>): Promise<void> {
  const resolvedDirectory = resolve(directory);
  const shouldOpenReport = options.open === true;
  const scanOverrides = buildScanOverrides(options);
  const config = mergeGitSnitchConfig(await loadGitSnitchConfig(resolvedDirectory), {
    ...buildSharedOverrides(options),
    scan: scanOverrides,
  });
  const scanOptions: ScanOptions = config.scan;
  const format = options.json ? "json" : config.report.format;
  const report = await generateScanReport({
    directory: resolvedDirectory,
    outputPath: options.output ?? config.report.outputPath,
    overwrite: options.overwrite ?? config.report.overwrite,
    open: shouldOpenReport,
    format,
    since: options.since,
    until: options.until,
    templatePath: options.template ?? config.report.templatePath,
    period: options.period,
    scan: scanOptions,
    anon: config.anon,
    noGitHub: config.noGitHub,
  }, { noGitHub: config.noGitHub });

  let finalReport = report;
  if (config.anon !== undefined) {
    const { report: anonReport, meta } = anonymizeReport(report, config.anon);
    if (anonReport.kind === "scan") {
      finalReport = { ...anonReport, anonymization: meta };
    }
  }

  const worklogOpts = resolveWorklogOptions(options as Record<string, unknown>, config.worklog);
  if (worklogOpts !== undefined) {
    if (options.json) {
      dependencies.io.stderr("Warning: Both --json and worklog options provided. Worklog output takes precedence.\n");
    }
    const result = await generateWorklog(finalReport, worklogOpts);
    const html = renderWorklogHtml(result);
    const worklogPath = resolve(
      worklogOpts.outputPath ?? deterministicWorklogPath("scan", basename(resolvedDirectory)),
    );
    await mkdir(dirname(worklogPath), { recursive: true });
    await writeFile(worklogPath, html, "utf8");
    dependencies.io.stdout(`Wrote worklog ${worklogPath}\n`);
    if (shouldOpenReport) {
      await dependencies.opener(worklogPath);
    }
    return;
  }

  if (format === "json") {
    dependencies.io.stdout(`${JSON.stringify(finalReport, null, 2)}\n`);
    return;
  }

  const outputPath = resolve(options.output ?? config.report.outputPath ?? deterministicOutputPath("scan", basename(resolvedDirectory)));
  await writeHtmlReport({ outputPath, overwrite: config.report.overwrite, templatePath: options.template ?? config.report.templatePath, report: finalReport });
  dependencies.io.stdout(`Wrote ${outputPath}\n`);
  if (shouldOpenReport) {
    await dependencies.opener(outputPath);
  }
}

function buildSharedOverrides(options: SharedCommandOptions): GitSnitchConfigOverrides {
  return {
    report: {
      outputPath: options.output,
      overwrite: options.overwrite,
      format: options.json ? "json" : undefined,
      templatePath: options.template,
    },
    anon: buildAnonOverrides(options),
    noGitHub: options.github === false ? true : undefined,
  };
}

function buildAnonOverrides(options: SharedCommandOptions): AnonOptions | undefined {
  if (options.anon) {
    return {
      hideNames: true,
      hideEmails: true,
      hidePaths: true,
      hideUrls: true,
      hashCommits: true,
      hideMessages: true,
      obfuscateKey: options.obfuscateKey,
    };
  }

  const anon: AnonOptions = {
    hideNames: options.hideNames,
    hideEmails: options.hideEmails,
    hidePaths: options.hidePaths,
    hideUrls: options.hideUrls,
    hashCommits: options.hashCommits,
    hideMessages: options.hideMessages,
    obfuscateKey: options.obfuscateKey,
  };

  const hasAnyField = (Object.values(anon) as (boolean | string | undefined)[]).some(
    (value) => value !== undefined,
  );
  return hasAnyField ? anon : undefined;
}

function buildScanOverrides(options: ScanCommandOptions): GitSnitchConfigOverrides["scan"] {
  return {
    maxDepth: options.maxDepth,
    excludePatterns: options.exclude ? [...options.exclude] : undefined,
  };
}

async function writeHtmlReport(options: {
  readonly outputPath: string;
  readonly overwrite: boolean;
  readonly templatePath?: string;
  readonly report: Parameters<typeof buildStandaloneReportHtml>[0]["report"];
}): Promise<void> {
  if (!options.overwrite && await pathExists(options.outputPath)) {
    throw new Error(`Output file already exists: ${options.outputPath}. Remove it, choose --output, or omit --no-overwrite to replace it.`);
  }
  await mkdir(dirname(options.outputPath), { recursive: true });
  const html = await buildStandaloneReportHtml({ report: options.report, templatePath: options.templatePath });
  await writeFile(options.outputPath, html, "utf8");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function deterministicOutputPath(kind: "repo" | "scan", name: string): string {
  return `git-snitch-${kind}-${slugify(name)}.html`;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new InvalidArgumentError("Expected a non-negative integer.");
  }
  return parsed;
}

function parseHarnessOption(value: string): string {
  const valid = ["opencode", "pi", "codex"];
  if (!valid.includes(value)) {
    throw new InvalidArgumentError(`Expected one of: ${valid.join(", ")}.`);
  }
  return value;
}

function parseSkillOption(value: string): string {
  const valid = ["repo-log", "work-log", "changelog", "devlog"];
  if (!valid.includes(value)) {
    throw new InvalidArgumentError(`Expected one of: ${valid.join(", ")}.`);
  }
  return value;
}

function collectValues(value: string, previous: readonly string[]): readonly string[] {
  return [...previous, value];
}

export function rewriteWorklogAliases(argv: readonly string[]): string[] {
  const aliasMap: ReadonlyMap<string, string> = new Map([
    ["--wl-prompt", "--worklog-prompt"],
    ["--wl-harness", "--worklog-harness"],
    ["--wl-model", "--worklog-model"],
    ["--wl-skill", "--worklog-skill"],
    ["--wl-output", "--worklog-output"],
  ]);
  return argv.map((arg) => aliasMap.get(arg) ?? arg);
}

function resolveWorklogOptions(
  options: Record<string, unknown>,
  configWorklog: { prompt?: string; harness?: string; model?: string; skill?: string; outputPath?: string },
): WorklogOptions | undefined {
  const hasAnyWorklogOption =
    options.worklogPrompt !== undefined ||
    options.worklogHarness !== undefined ||
    options.worklogModel !== undefined ||
    options.worklogSkill !== undefined ||
    options.worklogOutput !== undefined;

  if (!hasAnyWorklogOption) {
    return undefined;
  }

  return worklogOptionsSchema.parse({
    prompt: options.worklogPrompt ?? configWorklog.prompt,
    harness: options.worklogHarness ?? configWorklog.harness,
    model: options.worklogModel ?? configWorklog.model,
    skill: options.worklogSkill ?? configWorklog.skill,
    outputPath: options.worklogOutput ?? configWorklog.outputPath,
  });
}

function deterministicWorklogPath(kind: "repo" | "scan", name: string): string {
  return `git-snitch-worklog-${kind}-${name.replace(/[^a-z0-9]+/gi, "-")}.html`;
}

function normalizeOverwriteOption<Options extends SharedCommandOptions>(options: Options, command: Command): Options {
  if (command.getOptionValueSource("overwrite") === "cli") {
    return options;
  }

  return { ...options, overwrite: undefined };
}

function normalizeRepoCommandOptions(options: RepoCommandOptions, command: Command): RepoCommandOptions {
  const normalized = normalizeOverwriteOption(options, command);
  if (command.getOptionValueSource("branch") === "cli") {
    return normalized;
  }

  return { ...normalized, branch: undefined };
}

async function openFile(filePath: string): Promise<void> {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", filePath] : [filePath];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

const defaultIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

function isCommanderHelpOrVersion(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === "commander.helpDisplayed" || error.code === "commander.version");
}

function formatCliError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "commander.unknownCommand") {
    return "Unknown command. Use `git-snitch repo`, `git-snitch scan`, or `git-snitch worklog`. Run `git-snitch --help` for usage.";
  }
  return error instanceof Error ? error.message : "Unknown CLI error.";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
