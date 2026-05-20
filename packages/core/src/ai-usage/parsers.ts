import { statSync } from "node:fs";
import { basename } from "node:path";

import type { AiUsageRecord } from "./types.js";
import type { JsonObject } from "./utils.js";

import {
  arrayAt,
  clientRecordId,
  integerAt,
  isObject,
  isoFromTimestamp,
  modelProviderFromModel,
  numberAt,
  objectAt,
  parseJson,
  readJsonFile,
  readJsonLines,
  record,
  sqliteJsonRows,
  stringAt,
  tokens,
} from "./utils.js";

const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function fileTimestamp(path: string): string {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return DEFAULT_TIMESTAMP;
  }
}

function opencodeFromMessage(value: JsonObject, sourcePath: string, workspacePath?: string, rowId?: string, rowSessionId?: string): AiUsageRecord | undefined {
  if (stringAt(value, "role") !== "assistant") {
    return undefined;
  }
  const tokenObject = objectAt(value, "tokens");
  const model = stringAt(value, "modelID") ?? stringAt(value, "model");
  if (tokenObject === undefined || model === undefined) {
    return undefined;
  }
  const cache = objectAt(tokenObject, "cache");
  const time = objectAt(value, "time");
  const pathObject = objectAt(value, "path");
  const timestamp = isoFromTimestamp(numberAt(time ?? {}, "created") ?? stringAt(value, "timestamp"), fileTimestamp(sourcePath)) ?? DEFAULT_TIMESTAMP;
  return record({
    client: "opencode",
    sessionId: stringAt(value, "sessionID") ?? stringAt(value, "session_id") ?? rowSessionId ?? "unknown",
    messageId: stringAt(value, "id") ?? rowId,
    model,
    provider: stringAt(value, "providerID") ?? stringAt(value, "provider") ?? "unknown",
    timestamp,
    workspacePath: workspacePath ?? stringAt(pathObject ?? {}, "root"),
    sourcePath,
    tokens: tokens(integerAt(tokenObject, "input"), integerAt(tokenObject, "output"), integerAt(cache ?? {}, "read"), integerAt(cache ?? {}, "write"), integerAt(tokenObject, "reasoning")),
    cost: numberAt(value, "cost"),
  });
}

export function parseOpenCodeUsageFile(path: string): readonly AiUsageRecord[] {
  const parsed = readJsonFile(path);
  if (!isObject(parsed)) {
    return [];
  }
  const row = opencodeFromMessage(parsed, path, undefined, basename(path), undefined);
  return row === undefined ? [] : [row];
}

export function parseOpenCodeUsageSqlite(path: string): readonly AiUsageRecord[] {
  const sessionRecords = parseOpenCodeSessionTotalsSqlite(path);
  if (sessionRecords.length > 0) {
    return sessionRecords;
  }

  const query = "SELECT m.id AS id, m.session_id AS session_id, m.data AS data, NULLIF(s.directory, '') AS workspace_root FROM message m LEFT JOIN session s ON s.id = m.session_id WHERE json_valid(m.data) AND json_extract(m.data, '$.role') = 'assistant' AND json_extract(m.data, '$.tokens') IS NOT NULL ORDER BY m.id";
  return sqliteJsonRows(path, query).flatMap((row) => {
    const data = stringAt(row, "data");
    const parsed = data === undefined ? undefined : parseJson(data);
    if (!isObject(parsed)) {
      return [];
    }
    const item = opencodeFromMessage(parsed, path, stringAt(row, "workspace_root"), stringAt(row, "id"), stringAt(row, "session_id"));
    return item === undefined ? [] : [item];
  });
}

function parseOpenCodeSessionModel(value: string | undefined): { readonly model: string; readonly provider: string } {
  const parsed = value === undefined ? undefined : parseJson(value);
  if (isObject(parsed)) {
    return {
      model: stringAt(parsed, "id") ?? "unknown",
      provider: stringAt(parsed, "providerID") ?? stringAt(parsed, "provider") ?? "unknown",
    };
  }
  return { model: value ?? "unknown", provider: "unknown" };
}

function parseOpenCodeSessionTotalsSqlite(path: string): readonly AiUsageRecord[] {
  const query = "SELECT id, directory, model, agent, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_updated, time_created FROM session WHERE (tokens_input + tokens_output + tokens_reasoning + tokens_cache_read + tokens_cache_write) > 0 ORDER BY id";
  return sqliteJsonRows(path, query).map((row) => {
    const model = parseOpenCodeSessionModel(stringAt(row, "model"));
    return record({
      client: "opencode",
      sessionId: stringAt(row, "id") ?? "unknown",
      model: model.model,
      provider: model.provider,
      timestamp: isoFromTimestamp(integerAt(row, "time_updated") ?? integerAt(row, "time_created"), fileTimestamp(path)) ?? DEFAULT_TIMESTAMP,
      workspacePath: stringAt(row, "directory"),
      sourcePath: path,
      tokens: tokens(integerAt(row, "tokens_input"), integerAt(row, "tokens_output"), integerAt(row, "tokens_cache_read"), integerAt(row, "tokens_cache_write"), integerAt(row, "tokens_reasoning")),
      cost: numberAt(row, "cost"),
    });
  });
}

function claudeWorkspaceFromPath(path: string): string | undefined {
  const marker = "/projects/";
  const markerIndex = path.indexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }
  const encoded = path.slice(markerIndex + marker.length).split("/")[0];
  if (encoded === undefined || encoded.length === 0) {
    return undefined;
  }
  const decoded = encoded.replace(/-/gu, "/");
  return decoded.startsWith("/") ? decoded : `/${decoded}`;
}

export function parseClaudeUsageJsonl(path: string): readonly AiUsageRecord[] {
  return readJsonLines(path).flatMap((entry) => {
    if (stringAt(entry, "type") !== "assistant") {
      return [];
    }
    const message = objectAt(entry, "message");
    const usage = objectAt(message ?? {}, "usage");
    const model = stringAt(message ?? {}, "model");
    if (message === undefined || usage === undefined || model === undefined) {
      return [];
    }
    return [record({
      client: "claude",
      sessionId: stringAt(entry, "sessionId") ?? basename(path, ".jsonl"),
      messageId: stringAt(message, "id") ?? stringAt(entry, "requestId"),
      model,
      provider: "anthropic",
      timestamp: isoFromTimestamp(stringAt(entry, "timestamp"), fileTimestamp(path)) ?? DEFAULT_TIMESTAMP,
      workspacePath: claudeWorkspaceFromPath(path),
      sourcePath: path,
      tokens: tokens(integerAt(usage, "input_tokens"), integerAt(usage, "output_tokens"), integerAt(usage, "cache_read_input_tokens"), integerAt(usage, "cache_creation_input_tokens"), undefined),
    })];
  });
}

interface CodexTotals { readonly input: number; readonly output: number; readonly cacheRead: number; readonly reasoning: number }

function codexTotals(usage: JsonObject): CodexTotals {
  const cacheRead = Math.max(integerAt(usage, "cached_input_tokens") ?? 0, integerAt(usage, "cache_read_input_tokens") ?? 0);
  return {
    input: integerAt(usage, "input_tokens") ?? 0,
    output: integerAt(usage, "output_tokens") ?? 0,
    cacheRead,
    reasoning: integerAt(usage, "reasoning_output_tokens") ?? 0,
  };
}

function codexDelta(current: CodexTotals, previous: CodexTotals): CodexTotals {
  if (current.input < previous.input || current.output < previous.output || current.cacheRead < previous.cacheRead || current.reasoning < previous.reasoning) {
    return current;
  }
  return {
    input: current.input - previous.input,
    output: current.output - previous.output,
    cacheRead: current.cacheRead - previous.cacheRead,
    reasoning: current.reasoning - previous.reasoning,
  };
}

export function parseCodexUsageJsonl(path: string): readonly AiUsageRecord[] {
  let sessionId = basename(path, ".jsonl");
  let workspacePath: string | undefined;
  let provider: string | undefined;
  let model: string | undefined;
  let previousTotals: CodexTotals | undefined;
  const records: AiUsageRecord[] = [];
  for (const entry of readJsonLines(path)) {
    const payload = objectAt(entry, "payload");
    if (payload === undefined) {
      continue;
    }
    if (stringAt(payload, "type") === "session_meta" || stringAt(entry, "type") === "session_meta") {
      sessionId = stringAt(payload, "id") ?? sessionId;
      workspacePath = stringAt(payload, "cwd") ?? workspacePath;
      provider = stringAt(payload, "model_provider") ?? provider;
      model = stringAt(payload, "model") ?? stringAt(payload, "model_name") ?? model;
      continue;
    }
    const info = objectAt(payload, "info");
    const usage = objectAt(info ?? {}, "total_token_usage") ?? objectAt(info ?? {}, "last_token_usage");
    const eventModel = stringAt(payload, "model") ?? stringAt(payload, "model_name") ?? stringAt(info ?? {}, "model") ?? stringAt(info ?? {}, "model_name") ?? model;
    if (stringAt(payload, "type") !== "token_count" || usage === undefined || eventModel === undefined) {
      continue;
    }
    const currentTotals = codexTotals(usage);
    const delta = previousTotals === undefined || objectAt(info ?? {}, "last_token_usage") === usage ? currentTotals : codexDelta(currentTotals, previousTotals);
    previousTotals = currentTotals;
    records.push(record({
      client: "codex",
      sessionId,
      messageId: stringAt(payload, "id"),
      model: eventModel,
      provider: provider ?? modelProviderFromModel(eventModel, "openai"),
      timestamp: isoFromTimestamp(stringAt(entry, "timestamp"), fileTimestamp(path)) ?? DEFAULT_TIMESTAMP,
      workspacePath,
      sourcePath: path,
      tokens: tokens(delta.input - delta.cacheRead, delta.output, delta.cacheRead, 0, delta.reasoning),
    }));
  }
  return records;
}

function geminiRecord(value: JsonObject, path: string, sessionId: string, projectHash?: string, modelHint?: string): AiUsageRecord | undefined {
  const tokenObject = objectAt(value, "tokens") ?? objectAt(value, "usage") ?? value;
  const model = stringAt(value, "model") ?? modelHint;
  if (model === undefined) {
    return undefined;
  }
  const timestamp = isoFromTimestamp(stringAt(value, "timestamp") ?? stringAt(value, "startTime"), fileTimestamp(path)) ?? DEFAULT_TIMESTAMP;
  return record({
    client: "gemini",
    sessionId,
    messageId: stringAt(value, "id"),
    model,
    provider: "google",
    timestamp,
    projectHash,
    sourcePath: path,
    tokens: tokens(integerAt(tokenObject, "input") ?? integerAt(tokenObject, "inputTokens"), integerAt(tokenObject, "output") ?? integerAt(tokenObject, "outputTokens"), integerAt(tokenObject, "cached") ?? integerAt(tokenObject, "cacheRead"), integerAt(tokenObject, "cacheWrite"), integerAt(tokenObject, "thoughts") ?? integerAt(tokenObject, "reasoning")),
  });
}

export function parseGeminiUsageFile(path: string): readonly AiUsageRecord[] {
  if (path.endsWith(".jsonl")) {
    return readJsonLines(path).flatMap((line) => {
      const item = geminiRecord(line, path, stringAt(line, "sessionId") ?? basename(path, ".jsonl"), stringAt(line, "projectHash"), stringAt(line, "model"));
      return item === undefined ? [] : [item];
    });
  }
  const parsed = readJsonFile(path);
  if (!isObject(parsed)) {
    return [];
  }
  const messages = arrayAt(parsed, "messages");
  if (messages !== undefined) {
    return messages.filter(isObject).flatMap((message) => {
      if (stringAt(message, "type") !== undefined && stringAt(message, "type") !== "gemini") {
        return [];
      }
      const item = geminiRecord(message, path, stringAt(parsed, "sessionId") ?? basename(path, ".json"), stringAt(parsed, "projectHash"), stringAt(message, "model"));
      return item === undefined ? [] : [item];
    });
  }
  const item = geminiRecord(parsed, path, stringAt(parsed, "sessionId") ?? basename(path, ".json"), stringAt(parsed, "projectHash"), stringAt(parsed, "model"));
  return item === undefined ? [] : [item];
}

function ampUsageTokens(value: JsonObject): ReturnType<typeof tokens> {
  return tokens(integerAt(value, "input") ?? integerAt(value, "inputTokens"), integerAt(value, "output") ?? integerAt(value, "outputTokens"), integerAt(value, "cacheReadInputTokens"), integerAt(value, "cacheCreationInputTokens"), undefined);
}

export function parseAmpUsageFile(path: string): readonly AiUsageRecord[] {
  const parsed = readJsonFile(path);
  if (!isObject(parsed)) {
    return [];
  }
  const threadId = stringAt(parsed, "id") ?? basename(path, ".json");
  const workspacePath = stringAt(parsed, "cwd") ?? stringAt(parsed, "workspacePath") ?? stringAt(parsed, "rootPath");
  const created = isoFromTimestamp(integerAt(parsed, "created"), fileTimestamp(path)) ?? DEFAULT_TIMESTAMP;
  const ledgerEvents = arrayAt(objectAt(parsed, "usageLedger") ?? {}, "events")?.filter(isObject) ?? [];
  const ledgerRecords = ledgerEvents.flatMap((event) => {
    const model = stringAt(event, "model");
    const tokenObject = objectAt(event, "tokens");
    if (model === undefined || tokenObject === undefined) {
      return [];
    }
    return [record({ client: "amp", sessionId: threadId, messageId: integerAt(event, "toMessageId")?.toString(), model, provider: modelProviderFromModel(model, "anthropic"), timestamp: isoFromTimestamp(stringAt(event, "timestamp"), created) ?? DEFAULT_TIMESTAMP, workspacePath, sourcePath: path, tokens: ampUsageTokens(tokenObject), cost: numberAt(event, "credits") })];
  });
  if (ledgerRecords.length > 0) {
    return ledgerRecords;
  }
  return (arrayAt(parsed, "messages")?.filter(isObject) ?? []).flatMap((message) => {
    if (stringAt(message, "role") !== "assistant") {
      return [];
    }
    const usage = objectAt(message, "usage");
    const model = usage === undefined ? undefined : stringAt(usage, "model");
    if (usage === undefined || model === undefined) {
      return [];
    }
    return [record({ client: "amp", sessionId: threadId, messageId: integerAt(message, "messageId")?.toString(), model, provider: modelProviderFromModel(model, "anthropic"), timestamp: created, workspacePath, sourcePath: path, tokens: ampUsageTokens(usage), cost: numberAt(usage, "credits") })];
  });
}

export function parseKiloUsageSqlite(path: string): readonly AiUsageRecord[] {
  const query = "SELECT m.id AS id, m.session_id AS session_id, m.data AS data FROM message m WHERE json_valid(m.data) AND json_extract(m.data, '$.role') = 'assistant' AND json_extract(m.data, '$.tokens') IS NOT NULL ORDER BY m.id";
  return sqliteJsonRows(path, query).flatMap((row) => {
    const data = stringAt(row, "data");
    const parsed = data === undefined ? undefined : parseJson(data);
    if (!isObject(parsed)) {
      return [];
    }
    const item = opencodeFromMessage({ ...parsed, providerID: stringAt(parsed, "providerID") ?? "kilo" }, path, stringAt(parsed, "cwd"), stringAt(row, "id"), stringAt(row, "session_id"));
    return item === undefined ? [] : [{ ...item, client: "kilo" as const, provider: item.provider ?? "kilo" }];
  });
}

export function parsePiUsageJsonl(path: string): readonly AiUsageRecord[] {
  const lines = readJsonLines(path);
  const header = lines[0];
  if (header === undefined || stringAt(header, "type") !== "session") {
    return [];
  }
  const sessionId = stringAt(header, "id") ?? basename(path, ".jsonl");
  const workspacePath = stringAt(header, "cwd");
  return lines.slice(1).flatMap((entry) => {
    if (stringAt(entry, "type") !== "message") {
      return [];
    }
    const message = objectAt(entry, "message");
    const usage = objectAt(message ?? {}, "usage");
    const model = stringAt(message ?? {}, "model");
    if (message === undefined || usage === undefined || stringAt(message, "role") !== "assistant" || model === undefined) {
      return [];
    }
    return [record({ client: "pi", sessionId, messageId: stringAt(entry, "id"), model, provider: stringAt(message, "provider") ?? modelProviderFromModel(model, "pi"), timestamp: isoFromTimestamp(stringAt(entry, "timestamp"), fileTimestamp(path)) ?? DEFAULT_TIMESTAMP, workspacePath, sourcePath: path, tokens: tokens(integerAt(usage, "input"), integerAt(usage, "output"), integerAt(usage, "cacheRead"), integerAt(usage, "cacheWrite"), integerAt(usage, "reasoning")) })];
  });
}

export const AI_USAGE_SOURCE_NOTE = "Inspired by tokscale's local-session parsing approach. MIT reference: https://github.com/junhoyeo/tokscale. This module reimplements git-snitch-specific parsing rather than vendoring tokscale code.";

export function dedupeAiUsageRecords(records: readonly AiUsageRecord[]): readonly AiUsageRecord[] {
  const seen = new Set<string>();
  const result: AiUsageRecord[] = [];
  for (const item of records) {
    const key = item.messageId ?? clientRecordId(item.client, `${item.sessionId}:${item.timestamp}:${item.model}:${item.tokens.total}`);
    const scopedKey = `${item.client}:${item.sessionId}:${key}`;
    if (!seen.has(scopedKey)) {
      seen.add(scopedKey);
      result.push(item);
    }
  }
  return result;
}
