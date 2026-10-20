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
 *
 * Token conventions are normalized per client: Claude, OpenCode, Kilo, Amp, and
 * Pi report cache tokens outside of input, so their buckets are stored as
 * reported, while ZCode and Gemini report input inclusive of cached tokens, so
 * their parsers store input as the fresh (non-cached) portion. Devin's store
 * has no input/output split at all — its input bucket is the summed cumulative
 * context (num_tokens_preceding) of each assistant message. Across all clients
 * a record's total is the sum of its buckets and never double-counts cached
 * input.
 */
export type {
  AiModelPricing,
  AiModelPricingCandidate,
} from "./pricing.js";
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
  parseDevinUsageSqlite,
  parseGeminiUsageFile,
  parseKiloUsageSqlite,
  parseOpenCodeUsageFile,
  parseOpenCodeUsageSqlite,
  parsePiUsageJsonl,
  parseZcodeUsageSqlite,
} from "./parsers.js";
export {
  estimateAiUsageRecordCost,
  withEstimatedAiUsageCosts,
} from "./pricing.js";
