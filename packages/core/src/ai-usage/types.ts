import type { IsoDateString } from "../json.js";

export type AiClientId = "opencode" | "claude" | "codex" | "gemini" | "amp" | "kilo" | "pi";

export const AI_USAGE_CLIENTS = ["opencode", "claude", "codex", "gemini", "amp", "kilo", "pi"] as const satisfies readonly AiClientId[];

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
}

export interface AiUsageSummary {
  readonly records: number;
  readonly tokens: AiTokenBreakdown;
  readonly cost: number;
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
}
