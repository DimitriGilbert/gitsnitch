import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { DEFAULT_SCAN_MAX_DEPTH } from "../options";

import type { DiscoverRepositoriesOptions, DiscoveredRepository } from "./types";

const DEFAULT_EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".next",
  "coverage",
  "vendor",
  "target",
  "out",
]);

export async function discoverGitRepositories(
  baseDir: string,
  options: DiscoverRepositoriesOptions = {},
): Promise<readonly DiscoveredRepository[]> {
  const root = resolve(baseDir);
  const maxDepth = options.maxDepth ?? DEFAULT_SCAN_MAX_DEPTH;
  const discovered = new Map<string, DiscoveredRepository>();
  await walk(root, root, 0, maxDepth, options.exclude ?? [], discovered);
  return [...discovered.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function walk(
  root: string,
  current: string,
  depth: number,
  maxDepth: number,
  userExcludes: readonly string[],
  discovered: Map<string, DiscoveredRepository>,
): Promise<void> {
  if (depth > maxDepth) {
    return;
  }

  const entries = await readDirectory(current);
  if (entries.length === 0) {
    return;
  }

  if (entries.some((entry) => entry.isDirectory() && entry.name === ".git")) {
    const relativePath = relative(root, current) || ".";
    discovered.set(current, { path: current, relativePath });
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name !== ".git")
      .map((entry) => resolve(current, entry.name))
      .filter((path) => !isExcluded(root, path, userExcludes))
      .map((path) => walk(root, path, depth + 1, maxDepth, userExcludes, discovered)),
  );
}

async function readDirectory(path: string) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isExcluded(root: string, directory: string, userExcludes: readonly string[]): boolean {
  const relativePath = relative(root, directory);
  const parts = relativePath.split(sep);
  const name = parts.at(-1) ?? relativePath;
  if (DEFAULT_EXCLUDED_DIRECTORY_NAMES.has(name)) {
    return true;
  }

  return userExcludes.some((pattern) => matchesExclude(pattern, relativePath, name));
}

function matchesExclude(pattern: string, relativePath: string, name: string): boolean {
  const normalizedPattern = pattern.replaceAll("\\", "/");
  const normalizedPath = relativePath.split(sep).join("/");
  if (normalizedPattern === name || normalizedPattern === normalizedPath) {
    return true;
  }
  if (normalizedPattern.startsWith("**/") && normalizedPattern.endsWith("/**")) {
    const segment = normalizedPattern.slice(3, -3);
    return normalizedPath.split("/").includes(segment);
  }
  if (normalizedPattern.endsWith("/**")) {
    return normalizedPath.startsWith(normalizedPattern.slice(0, -3));
  }
  return false;
}
