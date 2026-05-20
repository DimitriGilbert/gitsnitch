import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Dirent } from "node:fs";

import type { AiClientId, AiUsageCollectionOptions, AiUsageRecord, AiUsageStoreRoots } from "./types.js";

import { AI_USAGE_CLIENTS } from "./types.js";
import {
  dedupeAiUsageRecords,
  parseAmpUsageFile,
  parseClaudeUsageJsonl,
  parseCodexUsageJsonl,
  parseGeminiUsageFile,
  parseKiloUsageSqlite,
  parseOpenCodeUsageFile,
  parseOpenCodeUsageSqlite,
  parsePiUsageJsonl,
} from "./parsers.js";

export class AiUsageCollectionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AiUsageCollectionError";
  }
}

const SQLITE_EXTENSIONS = [".db", ".sqlite", ".sqlite3"] as const;

/** Collects local assistant usage records from known client stores. */
export async function collectAiUsageRecords(options: AiUsageCollectionOptions = {}): Promise<readonly AiUsageRecord[]> {
  const clients = options.clients ?? clientsForOptions(options.storeRoots);
  const records: AiUsageRecord[] = [];

  for (const client of clients) {
    for (const root of rootsForClient(client, options.storeRoots)) {
      const files = await listStoreFiles(root);
      for (const file of files) {
        records.push(...parseClientFile(client, file));
      }
    }
  }

  return dedupeAiUsageRecords(records);
}

function clientsForOptions(storeRoots: AiUsageStoreRoots | undefined): readonly AiClientId[] {
  if (storeRoots === undefined) {
    return AI_USAGE_CLIENTS;
  }
  return AI_USAGE_CLIENTS.filter((client) => storeRoots[client] !== undefined);
}

function rootsForClient(client: AiClientId, overrides: AiUsageStoreRoots | undefined): readonly string[] {
  const configured = overrides?.[client];
  if (configured !== undefined) {
    return configured;
  }

  const home = homedir();
  switch (client) {
    case "opencode":
      return [join(home, ".local", "share", "opencode"), join(home, ".config", "opencode")];
    case "claude":
      return [join(home, ".claude", "projects")];
    case "codex":
      return [join(home, ".codex")];
    case "gemini":
      return [join(home, ".gemini")];
    case "amp":
      return [join(home, ".amp")];
    case "kilo":
      return [join(home, ".kilo")];
    case "pi":
      return [join(home, ".pi")];
  }
}

async function listStoreFiles(root: string): Promise<readonly string[]> {
  let rootStat: Awaited<ReturnType<typeof stat>>;
  try {
    rootStat = await stat(root);
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return [];
    }
    throw new AiUsageCollectionError(`Unable to inspect AI usage store ${root}: ${formatError(error)}`);
  }

  if (rootStat.isFile()) {
    return [root];
  }
  if (!rootStat.isDirectory()) {
    return [];
  }

  const files: string[] = [];
  await walkDirectory(root, files);
  return files;
}

async function walkDirectory(directory: string, files: string[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new AiUsageCollectionError(`Unable to read AI usage store directory ${directory}: ${formatError(error)}`);
  }

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(path, files);
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
}

function parseClientFile(client: AiClientId, path: string): readonly AiUsageRecord[] {
  try {
    switch (client) {
      case "opencode":
        return hasSqliteExtension(path) ? parseOpenCodeUsageSqlite(path) : path.endsWith(".json") ? parseOpenCodeUsageFile(path) : [];
      case "claude":
        return path.endsWith(".jsonl") ? parseClaudeUsageJsonl(path) : [];
      case "codex":
        return path.endsWith(".jsonl") ? parseCodexUsageJsonl(path) : [];
      case "gemini":
        return path.endsWith(".json") || path.endsWith(".jsonl") ? parseGeminiUsageFile(path) : [];
      case "amp":
        return path.endsWith(".json") ? parseAmpUsageFile(path) : [];
      case "kilo":
        return hasSqliteExtension(path) ? parseKiloUsageSqlite(path) : [];
      case "pi":
        return path.endsWith(".jsonl") ? parsePiUsageJsonl(path) : [];
    }
  } catch (error) {
    throw new AiUsageCollectionError(`Unable to parse AI usage store file ${path}: ${formatError(error)}`);
  }
}

function hasSqliteExtension(path: string): boolean {
  return SQLITE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
