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
  parseDevinUsageSqlite,
  parseGeminiUsageFile,
  parseKiloUsageSqlite,
  parseOpenCodeUsageFile,
  parseOpenCodeUsageSqlite,
  parsePiUsageJsonl,
  parseZcodeUsageSqlite,
  summarizeAiUsage,
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
    expect(records[0]?.tokens).toMatchObject({ input: 17, cacheRead: 3, total: 32 });
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

  it("parses ZCode SQLite model usage with workspace attribution", () => {
    const repo = tempPath("repo");
    const db = tempPath("zcode.db");
    createSqlite(db, `
      CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT NOT NULL);
      CREATE TABLE model_usage (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        reasoning_tokens INTEGER NOT NULL DEFAULT 0,
        cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_input_tokens INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO session VALUES ('z1', '${repo.replaceAll("'", "''")}');
      INSERT INTO model_usage VALUES ('u1', 'z1', 'GLM-5.3', 'builtin:zai-coding-plan', 1735689600000, 100, 20, 5, 12, 40);
      INSERT INTO model_usage VALUES ('u2', 'z1', 'GLM-5.3-Flash', 'builtin:zai-coding-plan', 1735689601000, 291209, 91, 0, 0, 289984);
    `);

    const records = parseZcodeUsageSqlite(db);

    expect(records).toHaveLength(2);
    expect(records[0]?.client).toBe("zcode");
    expect(records[0]?.sessionId).toBe("z1");
    expect(records[0]?.workspacePath).toBe(repo);
    expect(records[0]?.sourceAttribution).toBe("attributed");
    expect(records[0]?.model).toBe("GLM-5.3");
    expect(records[0]?.provider).toBe("builtin:zai-coding-plan");
    expect(records[0]?.timestamp).toBe("2025-01-01T00:00:00.000Z");
    expect(records[0]?.tokens).toMatchObject({ input: 48, output: 20, reasoning: 5, cacheWrite: 12, cacheRead: 40, total: 125 });
    expect(records[1]?.tokens).toMatchObject({ input: 1225, output: 91, cacheRead: 289984, total: 291300 });
  });

  it("aggregates same-day/same-model zcode rows into one record with recordCount, and honors the date filter", () => {
    const repo = tempPath("repo");
    const db = tempPath("zcode-agg.db");
    createSqlite(db, `
      CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT NOT NULL);
      CREATE TABLE model_usage (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        reasoning_tokens INTEGER NOT NULL DEFAULT 0,
        cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_input_tokens INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO session VALUES ('z1', '${repo.replaceAll("'", "''")}');
      INSERT INTO model_usage VALUES ('a1', 'z1', 'GLM-5.3', 'p', 1735689600000, 100, 20, 0, 0, 40);
      INSERT INTO model_usage VALUES ('a2', 'z1', 'GLM-5.3', 'p', 1735693200000, 10, 2, 0, 0, 4);
      INSERT INTO model_usage VALUES ('a3', 'z1', 'GLM-5.3', 'p', 1735862400000, 7, 1, 0, 0, 0);
    `);

    // All rows: day 1 groups a1+a2 (same session/model/day), day 2 keeps a3.
    const all = parseZcodeUsageSqlite(db);
    expect(all).toHaveLength(2);
    expect(all[0]?.recordCount).toBe(2);
    expect(all[0]?.tokens).toMatchObject({ input: 66, output: 22, cacheRead: 44, total: 132 });
    expect(all[0]?.timestamp).toBe("2025-01-01T00:00:00.000Z");
    expect(all[1]?.recordCount).toBe(1);
    // Summaries count messages, not groups.
    expect(summarizeAiUsage(all).records).toBe(3);

    // Date filter becomes the SQL window: only the Jan 2 row survives.
    const filtered = parseZcodeUsageSqlite(db, { since: "2025-01-02T00:00:00.000Z" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.recordCount).toBe(1);
    expect(filtered[0]?.tokens).toMatchObject({ input: 7, output: 1, total: 8 });
  });

  it("parses Devin sqlite usage with cumulative context mapped to input and workspace attribution", () => {
    const repo = tempPath("repo");
    const db = tempPath("devin.db");
    createSqlite(db, `
      CREATE TABLE sessions (id TEXT PRIMARY KEY, working_directory TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL, last_activity_at INTEGER NOT NULL);
      CREATE TABLE message_nodes (row_id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, node_id INTEGER NOT NULL, chat_message TEXT NOT NULL, created_at INTEGER NOT NULL, metadata TEXT);
      INSERT INTO sessions VALUES ('d1', '${repo.replaceAll("'", "''")}', 'swe-2-high', 1735689600, 1735689700);
      INSERT INTO sessions VALUES ('d2', '/other/workspace', 'swe-2-mini', 1735862400, 1735862500);
      INSERT INTO message_nodes (session_id, node_id, chat_message, created_at, metadata) VALUES
        ('d1', 1, '{"role":"assistant"}', 1735689600, '{"num_tokens_preceding":21235}'),
        ('d1', 2, '{"role":"assistant"}', 1735693200, '{"num_tokens_preceding":26423}'),
        ('d1', 3, '{"role":"user"}', 1735693201, NULL),
        ('d2', 1, '{"role":"assistant"}', 1735862400, '{"num_tokens_preceding":1000}');
    `);

    const records = parseDevinUsageSqlite(db);

    expect(records).toHaveLength(2);
    expect(records[0]?.client).toBe("devin");
    expect(records[0]?.sessionId).toBe("d1");
    expect(records[0]?.model).toBe("swe-2-high");
    expect(records[0]?.provider).toBe("devin");
    expect(records[0]?.workspacePath).toBe(repo);
    expect(records[0]?.sourceAttribution).toBe("attributed");
    expect(records[0]?.timestamp).toBe("2025-01-01T00:00:00.000Z");
    expect(records[0]?.recordCount).toBe(2);
    expect(records[0]?.tokens).toMatchObject({ input: 47658, output: 0, total: 47658 });
    expect(records[1]?.sessionId).toBe("d2");
    expect(records[1]?.tokens).toMatchObject({ input: 1000, total: 1000 });
  });

  it("skips devin rows without sessions or token metadata, normalizes blank models, and honors the date filter", () => {
    const db = tempPath("devin-edge.db");
    createSqlite(db, `
      CREATE TABLE sessions (id TEXT PRIMARY KEY, working_directory TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL, last_activity_at INTEGER NOT NULL);
      CREATE TABLE message_nodes (row_id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, node_id INTEGER NOT NULL, chat_message TEXT NOT NULL, created_at INTEGER NOT NULL, metadata TEXT);
      INSERT INTO sessions VALUES ('d1', '', '', 1735689600, 1735689700);
      INSERT INTO sessions VALUES ('d2', '/repo', 'swe-2-high', 1735862400, 1735862500);
      INSERT INTO message_nodes (session_id, node_id, chat_message, created_at, metadata) VALUES
        ('d1', 1, '{"role":"assistant"}', 1735689600, '{"num_tokens_preceding":42}'),
        ('d1', 2, '{"role":"assistant"}', 1735689601, '{"other":1}'),
        ('d1', 3, '{"role":"assistant"}', 1735689602, 'not-json{{{'),
        ('d1', 4, '{"role":"assistant"}', 1735689603, '{"num_tokens_preceding":"lots"}'),
        ('ghost', 1, '{"role":"assistant"}', 1735689604, '{"num_tokens_preceding":999}'),
        ('d2', 1, '{"role":"assistant"}', 1735862400, '{"num_tokens_preceding":7}');
    `);

    const all = parseDevinUsageSqlite(db);

    // The ghost message has no session row; the malformed-metadata row is
    // dropped by json_valid; 'lots' counts as zero tokens.
    expect(all).toHaveLength(2);
    expect(all[0]?.sessionId).toBe("d1");
    expect(all[0]?.model).toBe("unknown");
    expect(all[0]?.workspacePath).toBeUndefined();
    expect(all[0]?.sourceAttribution).toBe("unattributed");
    expect(all[0]?.recordCount).toBe(2);
    expect(all[0]?.tokens).toMatchObject({ input: 42, total: 42 });

    const filtered = parseDevinUsageSqlite(db, { since: "2025-01-02T00:00:00.000Z" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.sessionId).toBe("d2");
    expect(filtered[0]?.tokens).toMatchObject({ input: 7, total: 7 });
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
