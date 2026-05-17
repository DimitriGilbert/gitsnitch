import { basename } from "node:path";

import type { RepositoryIdentity } from "../repos.js";

import type { CommitBranchLookupOptions, CommandFailure, RepositoryInfoOptions } from "./types.js";

export async function getCurrentBranch(options: RepositoryInfoOptions): Promise<string | undefined> {
  try {
    const result = await options.runner("git", ["branch", "--show-current"], { cwd: options.repoPath });
    const branch = result.stdout.trim();
    return branch.length > 0 ? branch : undefined;
  } catch (error) {
    if (isMissingGitDataError(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function getRepositoryInfo(options: RepositoryInfoOptions): Promise<RepositoryIdentity> {
  const [rootPath, currentBranch, remoteUrl] = await Promise.all([
    resolveRootPath(options),
    getCurrentBranch(options),
    getOriginRemoteUrl(options),
  ]);

  return {
    name: basename(rootPath),
    path: options.repoPath,
    rootPath,
    ...(currentBranch ? { currentBranch } : {}),
    ...(remoteUrl ? { remoteUrl } : {}),
  };
}

export async function getCommitBranches(options: CommitBranchLookupOptions): Promise<readonly string[]> {
  try {
    const result = await options.runner("git", ["branch", "-a", "--contains", options.commitHash], { cwd: options.repoPath });
    const branches = result.stdout
      .split("\n")
      .map((line) => line.trim().replace(/^\*\s+/, ""))
      .filter((line) => line.length > 0)
      .map(normalizeBranchName)
      .filter((line): line is string => line !== undefined);

    return [...new Set(branches)];
  } catch (error) {
    if (isMissingGitDataError(error)) {
      return [];
    }
    throw error;
  }
}

export function normalizeRemoteUrl(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const scpLike = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(trimmed);
  if (scpLike) {
    const host = scpLike[1];
    const repoPath = scpLike[2];
    if (host && repoPath) {
      return `https://${host}/${repoPath}`;
    }
  }

  const sshRemote = parseSshRemoteUrl(trimmed);
  if (sshRemote) {
    return sshRemote;
  }

  if (trimmed.endsWith(".git")) {
    return trimmed.slice(0, -4);
  }

  return trimmed;
}

function parseSshRemoteUrl(remoteUrl: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "ssh:") {
    return undefined;
  }

  const repoPath = parsed.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
  if (parsed.hostname.length === 0 || repoPath.length === 0) {
    return undefined;
  }

  return `https://${parsed.hostname}/${repoPath}`;
}

async function resolveRootPath(options: RepositoryInfoOptions): Promise<string> {
  try {
    const result = await options.runner("git", ["rev-parse", "--show-toplevel"], { cwd: options.repoPath });
    const rootPath = result.stdout.trim();
    return rootPath.length > 0 ? rootPath : options.repoPath;
  } catch (error) {
    if (isMissingGitDataError(error)) {
      return options.repoPath;
    }
    throw error;
  }
}

async function getOriginRemoteUrl(options: RepositoryInfoOptions): Promise<string | undefined> {
  try {
    const result = await options.runner("git", ["config", "--get", "remote.origin.url"], { cwd: options.repoPath });
    return normalizeRemoteUrl(result.stdout);
  } catch (error) {
    if (isMissingGitDataError(error)) {
      return undefined;
    }
    throw error;
  }
}

function normalizeBranchName(branch: string): string | undefined {
  if (branch.includes("HEAD ->")) {
    return undefined;
  }
  return branch.startsWith("remotes/origin/") ? branch.slice("remotes/origin/".length) : branch;
}

function isMissingGitDataError(error: unknown): error is CommandFailure {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = `${error.message}\n${readStringProperty(error, "stdout") ?? ""}\n${readStringProperty(error, "stderr") ?? ""}`;
  return (
    text.includes("No such remote") ||
    text.includes("not a git repository") ||
    text.includes("commits yet") ||
    text.includes("no such commit") ||
    text.includes("malformed object name") ||
    readNumberProperty(error, "exitCode") === 1
  );
}

function readStringProperty(value: object, property: "stdout" | "stderr"): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  return typeof descriptor?.value === "string" ? descriptor.value : undefined;
}

function readNumberProperty(value: object, property: "exitCode"): number | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  return typeof descriptor?.value === "number" ? descriptor.value : undefined;
}
