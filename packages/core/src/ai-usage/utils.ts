import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AiClientId, AiTokenBreakdown, AiUsageRecord } from "./types.js";
import type { IsoDateString } from "../json.js";

export type JsonObject = { readonly [key: string]: unknown };

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function objectAt(value: JsonObject, key: string): JsonObject | undefined {
  const child = value[key];
  return isObject(child) ? child : undefined;
}

export function arrayAt(value: JsonObject, key: string): readonly unknown[] | undefined {
  const child = value[key];
  return Array.isArray(child) ? child : undefined;
}

export function stringAt(value: JsonObject, key: string): string | undefined {
  const child = value[key];
  return typeof child === "string" && child.trim().length > 0 ? child : undefined;
}

export function numberAt(value: JsonObject, key: string): number | undefined {
  const child = value[key];
  return typeof child === "number" && Number.isFinite(child) ? child : undefined;
}

export function integerAt(value: JsonObject, key: string): number | undefined {
  const number = numberAt(value, key);
  return number === undefined ? undefined : Math.trunc(number);
}

export function nonnegative(value: number | undefined): number {
  return Math.max(0, Math.trunc(value ?? 0));
}

export function tokens(input: number | undefined, output: number | undefined, cacheRead: number | undefined, cacheWrite: number | undefined, reasoning: number | undefined): AiTokenBreakdown {
  const normalized = {
    input: nonnegative(input),
    output: nonnegative(output),
    cacheRead: nonnegative(cacheRead),
    cacheWrite: nonnegative(cacheWrite),
    reasoning: nonnegative(reasoning),
  };
  return { ...normalized, total: normalized.input + normalized.output + normalized.cacheRead + normalized.cacheWrite + normalized.reasoning };
}

export function isoFromTimestamp(value: string | number | undefined, fallback?: IsoDateString): IsoDateString | undefined {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 9_999_999_999 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }
  return fallback;
}

export function normalizeWorkspacePath(path: string | undefined): string | undefined {
  if (path === undefined || path.trim().length === 0) {
    return undefined;
  }
  return resolve(path);
}

export function attributionFor(workspacePath: string | undefined, projectHash?: string): AiUsageRecord["sourceAttribution"] {
  if (workspacePath !== undefined) {
    return "attributed";
  }
  if (projectHash !== undefined) {
    return "project-hash-only";
  }
  return "unattributed";
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function readJsonFile(path: string): unknown {
  return parseJson(readFileSync(path, "utf8"));
}

export function readJsonLines(path: string): readonly JsonObject[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseJson)
    .filter(isObject);
}

export function sqliteJsonRows(dbPath: string, query: string): readonly JsonObject[] {
  try {
    const output = execFileSync("sqlite3", ["-readonly", "-json", dbPath, query], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    const parsed = parseJson(output.length === 0 ? "[]" : output);
    return Array.isArray(parsed) ? parsed.filter(isObject) : [];
  } catch {
    return [];
  }
}

export function modelProviderFromModel(model: string, fallback: string): string {
  if (model.includes("claude")) {
    return "anthropic";
  }
  if (model.includes("gemini")) {
    return "google";
  }
  if (model.includes("gpt") || model.includes("o3") || model.includes("o4")) {
    return "openai";
  }
  return fallback;
}

export function record(input: Omit<AiUsageRecord, "sourceAttribution" | "workspacePath"> & { readonly workspacePath?: string }): AiUsageRecord {
  const workspacePath = normalizeWorkspacePath(input.workspacePath);
  return {
    ...input,
    ...(workspacePath === undefined ? {} : { workspacePath }),
    sourceAttribution: attributionFor(workspacePath, input.projectHash),
  };
}

export function clientRecordId(client: AiClientId, fallback: string): string {
  return `${client}:${fallback}`;
}
