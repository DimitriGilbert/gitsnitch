import type { CommitFileChange, CommitRecord } from "../commits";

import type { AsyncCommandRunner, CommandFailure, GitLogOptions } from "./types";

const RECORD_SEPARATOR = "\x1e";
const FIELD_SEPARATOR = "\x1f";

interface ParsedHeader {
  readonly hash: string;
  readonly shortHash: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly authoredAt: string;
  readonly committedAt: string;
  readonly parents: readonly string[];
  readonly refs: readonly string[];
  readonly subject: string;
  readonly body?: string;
}

export interface GitLogCommandOptions {
  readonly since?: string;
  readonly until?: string;
  readonly branches?: readonly string[];
  readonly allBranches?: boolean;
}

export function buildGitLogArgs(options: GitLogCommandOptions = {}): readonly string[] {
  const args = [
    "log",
    "--date=iso-strict",
    "--numstat",
    `--pretty=format:${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%cI${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%D${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b`,
  ];

  if (options.since) {
    args.push(`--since=${options.since}`);
  }
  if (options.until) {
    args.push(`--until=${options.until}`);
  }
  if (options.allBranches) {
    args.push("--all");
  } else if (options.branches && options.branches.length > 0) {
    args.push(...options.branches);
  }

  return args;
}

export async function getGitCommits(options: GitLogOptions): Promise<readonly CommitRecord[]> {
  const branches = await resolveLogBranches(options);
  const args = buildGitLogArgs({
    since: options.since,
    until: options.until,
    branches,
    allBranches: options.allBranches,
  });

  try {
    const output = await options.runner("git", args, { cwd: options.repoPath });
    return parseGitLogOutput(output.stdout);
  } catch (error) {
    if (isEmptyHistoryError(error)) {
      return [];
    }
    throw error;
  }
}

async function resolveLogBranches(options: GitLogOptions): Promise<readonly string[] | undefined> {
  if (options.allBranches || (options.branches && options.branches.length > 0)) {
    return options.branches;
  }

  const currentBranch = await getBranchName(options.runner, options.repoPath);
  return currentBranch ? [currentBranch] : undefined;
}

async function getBranchName(runner: AsyncCommandRunner, repoPath: string): Promise<string | undefined> {
  try {
    const result = await runner("git", ["branch", "--show-current"], { cwd: repoPath });
    const branch = result.stdout.trim();
    return branch.length > 0 ? branch : undefined;
  } catch (error) {
    if (isEmptyHistoryError(error)) {
      return undefined;
    }
    throw error;
  }
}

function parseGitLogOutput(output: string): readonly CommitRecord[] {
  if (output.trim().length === 0) {
    return [];
  }

  return output
    .split(RECORD_SEPARATOR)
    .map((record) => parseRecord(record))
    .filter((record): record is CommitRecord => record !== undefined);
}

function parseRecord(record: string): CommitRecord | undefined {
  const trimmed = record.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const [headerLine, ...fileLines] = trimmed.split("\n");
  if (!headerLine) {
    return undefined;
  }

  const header = parseHeader(headerLine);
  if (!header) {
    return undefined;
  }

  return {
    hash: header.hash,
    shortHash: header.shortHash,
    message: header.subject,
    ...(header.body ? { body: header.body } : {}),
    author: {
      name: header.authorName,
      email: header.authorEmail,
    },
    authoredAt: header.authoredAt,
    committedAt: header.committedAt,
    parents: header.parents,
    refs: header.refs,
    classification: "other",
    files: fileLines.map((line) => parseFileChange(line)).filter((change): change is CommitFileChange => change !== undefined),
  };
}

function parseHeader(line: string): ParsedHeader | undefined {
  const fields = line.split(FIELD_SEPARATOR);
  if (fields.length < 9) {
    return undefined;
  }

  const [hash, shortHash, authorName, authorEmail, authoredAt, committedAt, parents, refs, subject, body] = fields;
  if (!hash || !shortHash || !authorName || !authorEmail || !authoredAt || !committedAt || !subject) {
    return undefined;
  }

  return {
    hash,
    shortHash,
    authorName,
    authorEmail,
    authoredAt,
    committedAt,
    parents: parents ? parents.split(" ").filter(Boolean) : [],
    refs: refs ? refs.split(", ").filter(Boolean) : [],
    subject,
    ...(body && body.trim().length > 0 ? { body: body.trim() } : {}),
  };
}

function parseFileChange(line: string): CommitFileChange | undefined {
  const parts = line.split("\t");
  if (parts.length < 3) {
    return undefined;
  }

  const [rawAdditions, rawDeletions, path, previousPath] = parts;
  if (!rawAdditions || !rawDeletions || !path) {
    return undefined;
  }

  const additions = parseNumstatValue(rawAdditions);
  const deletions = parseNumstatValue(rawDeletions);
  if (additions === undefined || deletions === undefined) {
    return undefined;
  }

  const status = additions > 0 && deletions === 0 ? "added" : additions === 0 && deletions > 0 ? "deleted" : "modified";

  return {
    path,
    additions,
    deletions,
    status,
    ...(previousPath ? { previousPath } : {}),
  };
}

function parseNumstatValue(value: string): number | undefined {
  if (value === "-") {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function isEmptyHistoryError(error: unknown): error is CommandFailure {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = `${error.message}\n${readStringProperty(error, "stdout") ?? ""}\n${readStringProperty(error, "stderr") ?? ""}`;
  return text.includes("commits yet") || text.includes("unknown revision") || text.includes("ambiguous argument");
}

function readStringProperty(value: object, property: "stdout" | "stderr"): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  return typeof descriptor?.value === "string" ? descriptor.value : undefined;
}
