import type { IsoDateString } from "../json.js";

export type AiClientId = "opencode" | "claude" | "codex" | "gemini" | "amp" | "kilo" | "pi" | "zcode";

export const AI_USAGE_CLIENTS = ["opencode", "claude", "codex", "gemini", "amp", "kilo", "pi", "zcode"] as const satisfies readonly AiClientId[];

export interface AiTokenBreakdown {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly reasoning: number;
  readonly total: number;
}

export type AiSourceAttributionStatus = "attributed" | "unattributed" | "project-hash-only";

export interface AiUsageRecord {
  readonly client: AiClientId;
  readonly sessionId: string;
  readonly messageId?: string;
  readonly model: string;
  readonly provider?: string;
  readonly timestamp: IsoDateString;
  readonly workspacePath?: string;
  readonly projectHash?: string;
  readonly sourcePath?: string;
  readonly sourceAttribution: AiSourceAttributionStatus;
  readonly tokens: AiTokenBreakdown;
  readonly cost?: number;
  readonly unsubsidizedCost?: number;
  /**
   * How many underlying messages this record carries when the parser
   * pre-aggregates in SQL (zcode's store groups rows per session/day/model —
   * its sqlite holds 100k+ rows and shipping each one through JSON would
   * dominate report time). Parsers that emit one record per message omit it;
   * summaries count `recordCount ?? 1` so totals stay honest either way.
   */
  readonly recordCount?: number;
}

export interface AiUsageSummary {
  readonly records: number;
  readonly tokens: AiTokenBreakdown;
  readonly cost: number;
  readonly unsubsidizedCost?: number;
}

export interface AiUsageBreakdownItem extends AiUsageSummary {
  readonly key: string;
}

export interface AiUsageBreakdowns {
  readonly byClient: readonly AiUsageBreakdownItem[];
  readonly byModel: readonly AiUsageBreakdownItem[];
  readonly byDay: readonly AiUsageBreakdownItem[];
}

export interface AiUsageProjectSummary extends AiUsageSummary {
  readonly repoPath: string;
  readonly records: number;
  readonly breakdowns: AiUsageBreakdowns;
}

export interface AiUsageMultiRepoSummary {
  readonly projects: readonly AiUsageProjectSummary[];
  readonly matchedTotal: ReportAiUsageProjectSummary;
}

export type ReportAiUsageProjectSummary = Omit<AiUsageProjectSummary, "repoPath">;

export interface AiUsageDateFilter {
  readonly since?: IsoDateString;
  readonly until?: IsoDateString;
}

export type AiUsageStoreRoots = Readonly<Partial<Record<AiClientId, readonly string[]>>>;

export interface AiUsageCollectionOptions {
  readonly clients?: readonly AiClientId[];
  readonly storeRoots?: AiUsageStoreRoots;
  /**
   * The report's since/until window, forwarded to parsers that can push it
   * into their store query (zcode's sqlite) so a period report never
   * materializes history outside its window. Parsers without query-side
   * filtering ignore it — the shared date filter still narrows downstream.
   */
  readonly dateFilter?: AiUsageDateFilter;
}
