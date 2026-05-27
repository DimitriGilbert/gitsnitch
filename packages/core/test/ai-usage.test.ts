import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import type { AiUsageRecord } from "../src/index.js";

import {
  estimateAiUsageRecordCost,
  parseAmpUsageFile,
  parseClaudeUsageJsonl,
  parseCodexUsageJsonl,
  parseGeminiUsageFile,
  parseKiloUsageSqlite,
  parseOpenCodeUsageFile,
  parseOpenCodeUsageSqlite,
  parsePiUsageJsonl,
  summarizeAiUsageForRepo,
  summarizeAiUsageForRepos,
} from "../src/index.js";

function tempPath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), "git-snitch-ai-usage-")), name);
}

function writeJson(path: string, value: unknown): string {
  writeFileSync(path, JSON.stringify(value), "utf8");
  return path;
}

function writeJsonl(path: string, values: readonly unknown[]): string {
  writeFileSync(path, values.map((value) => JSON.stringify(value)).join("\n"), "utf8");
  return path;
}

function createSqlite(path: string, sql: string): string {
  execFileSync("sqlite3", [path, sql]);
  return path;
}

describe("AI usage parsers", () => {
  it("parses OpenCode SQLite and legacy JSON usage", () => {
    const repo = tempPath("repo");
    const db = tempPath("opencode.db");
    createSqlite(db, `
      CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT);
      CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT);
      INSERT INTO session VALUES ('s1', '${repo.replaceAll("'", "''")}');
      INSERT INTO message VALUES ('m1', 's1', '{"role":"assistant","modelID":"claude-3-5-sonnet","providerID":"anthropic","tokens":{"input":10,"output":3,"reasoning":2,"cache":{"read":4,"write":1}},"time":{"created":1735689600000}}');
    `);
    const legacy = writeJson(tempPath("legacy.json"), {
      id: "legacy-1",
      sessionID: "legacy-session",
      role: "assistant",
      modelID: "gpt-4.1",
      providerID: "openai",
      tokens: { input: 5, output: 2, cache: { read: 1, write: 0 } },
      time: { created: 1_735_689_601_000 },
      path: { root: repo },
    });

    const records = [...parseOpenCodeUsageSqlite(db), ...parseOpenCodeUsageFile(legacy)];

    expect(records).toHaveLength(2);
    expect(records[0]?.client).toBe("opencode");
    expect(records[0]?.workspacePath).toBe(repo);
    expect(records[0]?.tokens.total).toBe(20);
    expect(records[1]?.model).toBe("gpt-4.1");
  });

  it("parses modern OpenCode SQLite session token totals", () => {
    const repo = tempPath("repo");
    const db = tempPath("opencode-modern.db");
    createSqlite(db, `
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        directory TEXT NOT NULL,
        model TEXT,
        agent TEXT,
        cost REAL NOT NULL DEFAULT 0,
        tokens_input INTEGER NOT NULL DEFAULT 0,
        tokens_output INTEGER NOT NULL DEFAULT 0,
        tokens_reasoning INTEGER NOT NULL DEFAULT 0,
        tokens_cache_read INTEGER NOT NULL DEFAULT 0,
        tokens_cache_write INTEGER NOT NULL DEFAULT 0,
        time_created INTEGER NOT NULL,
        time_updated INTEGER NOT NULL
      );
      CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT);
      INSERT INTO session VALUES ('s-modern', '${repo.replaceAll("'", "''")}', '{"id":"glm-5.1","providerID":"zai-coding-plan"}', 'build', 0.5, 100, 20, 3, 400, 4, 1735689600000, 1735689700000);
    `);

    const records = parseOpenCodeUsageSqlite(db);

    expect(records).toHaveLength(1);
    expect(records[0]?.workspacePath).toBe(repo);
    expect(records[0]?.model).toBe("glm-5.1");
    expect(records[0]?.provider).toBe("zai-coding-plan");
    expect(records[0]?.tokens.total).toBe(527);
    expect(records[0]?.cost).toBe(0.5);
  });

  it("parses Claude project JSONL usage and decodes workspace attribution", () => {
    const root = mkdtempSync(join(tmpdir(), "git-snitch-claude-projects-"));
    const file = join(root, "projects", "tmp-repo", "session.jsonl");
    execFileSync("mkdir", ["-p", join(root, "projects", "tmp-repo")]);
    writeJsonl(file, [
      { type: "user", timestamp: "2025-01-01T00:00:00.000Z" },
      { type: "assistant", timestamp: "2025-01-01T00:00:01.000Z", message: { id: "c1", model: "claude-3-5-sonnet", usage: { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 5, cache_creation_input_tokens: 2 } } },
    ]);

    const records = parseClaudeUsageJsonl(file);

    expect(records).toHaveLength(1);
    expect(records[0]?.workspacePath).toBe("/tmp/repo");
    expect(records[0]?.tokens.total).toBe(25);
  });

  it("parses Codex JSONL token_count events with cumulative deltas", () => {
    const repo = tempPath("repo");
    const file = writeJsonl(tempPath("codex.jsonl"), [
      { type: "event", payload: { type: "session_meta", id: "codex-session", cwd: repo, model_provider: "openai", model: "gpt-5" } },
      { timestamp: "2025-01-01T00:00:01.000Z", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20, reasoning_output_tokens: 10 } } } },
      { timestamp: "2025-01-01T00:00:02.000Z", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 150, cached_input_tokens: 60, output_tokens: 25, reasoning_output_tokens: 15 } } } },
    ]);

    const records = parseCodexUsageJsonl(file);

    expect(records).toHaveLength(2);
    expect(records[0]?.tokens).toMatchObject({ input: 60, cacheRead: 40, output: 20, reasoning: 10, total: 130 });
    expect(records[1]?.tokens).toMatchObject({ input: 30, cacheRead: 20, output: 5, reasoning: 5, total: 60 });
  });

  it("parses Gemini JSON token records with project-hash-only attribution", () => {
    const file = writeJson(tempPath("session-gemini.json"), {
      sessionId: "gemini-session",
      projectHash: "hash-123",
      messages: [{ id: "g1", type: "gemini", timestamp: "2025-01-01T00:00:01.000Z", model: "gemini-2.5-pro", tokens: { input: 20, output: 8, cached: 3, thoughts: 4 } }],
    });

    const records = parseGeminiUsageFile(file);

    expect(records).toHaveLength(1);
    expect(records[0]?.sourceAttribution).toBe("project-hash-only");
    expect(records[0]?.tokens.total).toBe(35);
  });

  it("parses Amp thread usageLedger records", () => {
    const repo = tempPath("repo");
    const file = writeJson(tempPath("amp.json"), {
      id: "amp-thread",
      workspacePath: repo,
      usageLedger: { events: [{ timestamp: "2025-01-01T00:00:01.000Z", model: "claude-3-5-sonnet", credits: 0.25, tokens: { input: 12, output: 4, cacheReadInputTokens: 6, cacheCreationInputTokens: 1 } }] },
    });

    const records = parseAmpUsageFile(file);

    expect(records).toHaveLength(1);
    expect(records[0]?.workspacePath).toBe(repo);
    expect(records[0]?.cost).toBe(0.25);
  });

  it("parses Kilo SQLite message table records", () => {
    const db = tempPath("kilo.db");
    createSqlite(db, `
      CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT);
      INSERT INTO message VALUES ('k1', 'kilo-session', '{"role":"assistant","modelID":"minimax/m2.5","providerID":"kilo","tokens":{"input":9,"output":4,"reasoning":1,"cache":{"read":2,"write":1}},"time":{"created":1735689600000}}');
    `);

    const records = parseKiloUsageSqlite(db);

    expect(records).toHaveLength(1);
    expect(records[0]?.client).toBe("kilo");
    expect(records[0]?.sourceAttribution).toBe("unattributed");
    expect(records[0]?.tokens.total).toBe(17);
  });

  it("parses Pi JSONL session header cwd and assistant usage", () => {
    const repo = tempPath("repo");
    const file = writeJsonl(tempPath("pi.jsonl"), [
      { type: "session", id: "pi-session", cwd: repo, timestamp: "2025-01-01T00:00:00.000Z" },
      { type: "message", id: "p1", timestamp: "2025-01-01T00:00:01.000Z", message: { role: "assistant", model: "claude-3-5-sonnet", provider: "anthropic", usage: { input: 15, output: 5, cacheRead: 2, cacheWrite: 1 } } },
    ]);

    const records = parsePiUsageJsonl(file);

    expect(records).toHaveLength(1);
    expect(records[0]?.workspacePath).toBe(repo);
    expect(records[0]?.tokens.total).toBe(23);
  });
});

describe("AI usage aggregation", () => {
  it("estimates cost from model pricing instead of subsidized recorded cost", () => {
    const record: AiUsageRecord = {
      client: "opencode",
      sessionId: "session",
      model: "glm-5.1",
      provider: "zai-coding-plan",
      timestamp: "2025-01-01T00:00:00.000Z",
      sourceAttribution: "unattributed",
      tokens: { input: 1_000_000, cacheRead: 500_000, cacheWrite: 100_000, output: 250_000, reasoning: 50_000, total: 1_900_000 },
      cost: 0,
    };

    expect(estimateAiUsageRecordCost(record)).toBeCloseTo(2.99, 6);
  });

  it("estimates GPT costs with cached input pricing", () => {
    const record: AiUsageRecord = {
      client: "codex",
      sessionId: "session",
      model: "gpt-5.5",
      provider: "openai",
      timestamp: "2025-01-01T00:00:00.000Z",
      sourceAttribution: "unattributed",
      tokens: { input: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0, output: 100_000, reasoning: 100_000, total: 2_200_000 },
    };

    expect(estimateAiUsageRecordCost(record)).toBeCloseTo(11.5, 6);
  });

  it("matches strict normalized repo paths and excludes unattributed records", () => {
    const repo = tempPath("repo");
    const nested = join(repo, "packages", "core");
    const matched = writeJsonl(tempPath("matched.pi.jsonl"), [
      { type: "session", id: "pi-session", cwd: nested },
      { type: "message", id: "p1", timestamp: "2025-01-02T00:00:00.000Z", message: { role: "assistant", model: "claude-3-5-sonnet", provider: "anthropic", usage: { input: 10, output: 5 } } },
    ]);
    const unattributed = writeJson(tempPath("gemini.json"), { sessionId: "g", projectHash: "hash", messages: [{ id: "g1", type: "gemini", timestamp: "2025-01-02T00:00:00.000Z", model: "gemini-2.5-pro", tokens: { input: 100, output: 50 } }] });
    const records = [...parsePiUsageJsonl(matched), ...parseGeminiUsageFile(unattributed)];

    const summary = summarizeAiUsageForRepo(records, repo, { since: "2025-01-01T00:00:00.000Z", until: "2025-01-03T00:00:00.000Z" });
    const multi = summarizeAiUsageForRepos(records, [repo]);

    expect(summary.records).toBe(1);
    expect(summary.tokens.total).toBe(15);
    expect(summary.breakdowns.byClient).toEqual([expect.objectContaining({ key: "pi", records: 1 })]);
    expect(multi.matchedTotal.tokens.total).toBe(15);
    expect(multi.matchedTotal.breakdowns.byClient).toEqual([expect.objectContaining({ key: "pi", records: 1 })]);
    expect(multi.matchedTotal.breakdowns.byModel).toEqual([expect.objectContaining({ key: "claude-3-5-sonnet", records: 1 })]);
  });
});
