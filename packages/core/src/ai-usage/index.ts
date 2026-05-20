/**
 * Core AI usage parsing and aggregation for local assistant stores.
 * Inspired by tokscale's provider-reported local-session parsing approach.
 * MIT reference: https://github.com/junhoyeo/tokscale. This is a git-snitch
 * implementation and does not vendor tokscale code.
 *
 * SQLite readers use the local sqlite3 CLI when available and return no rows
 * when it is unavailable. Gemini projectHash-only, Amp thread data without path
 * metadata, and Kilo rows without session metadata remain unattributed by
 * design; unattributed records never match repository summaries.
 */
export type {
  AiClientId,
  AiSourceAttributionStatus,
  AiTokenBreakdown,
  AiUsageBreakdownItem,
  AiUsageBreakdowns,
  AiUsageDateFilter,
  AiUsageMultiRepoSummary,
  AiUsageProjectSummary,
  AiUsageRecord,
  AiUsageSummary,
  AiUsageCollectionOptions,
  AiUsageStoreRoots,
  ReportAiUsageProjectSummary,
} from "./types.js";

export {
  AI_USAGE_CLIENTS,
} from "./types.js";
export {
  AiUsageCollectionError,
  collectAiUsageRecords,
} from "./collect.js";
export {
  emptyAiUsageSummary,
  filterAiUsageByDate,
  filterAiUsageForRepo,
  isWorkspaceInRepo,
  summarizeAiUsage,
  summarizeAiUsageBreakdowns,
  summarizeAiUsageForRepo,
  summarizeAiUsageForRepos,
} from "./aggregate.js";
export {
  AI_USAGE_SOURCE_NOTE,
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
