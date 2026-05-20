import { relative, resolve } from "node:path";

import type {
  AiTokenBreakdown,
  AiUsageBreakdownItem,
  AiUsageBreakdowns,
  AiUsageDateFilter,
  AiUsageMultiRepoSummary,
  AiUsageProjectSummary,
  AiUsageRecord,
  AiUsageSummary,
  ReportAiUsageProjectSummary,
} from "./types.js";

function zeroTokens(): AiTokenBreakdown {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 };
}

function addTokens(left: AiTokenBreakdown, right: AiTokenBreakdown): AiTokenBreakdown {
  return {
    input: left.input + right.input,
    output: left.output + right.output,
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
    reasoning: left.reasoning + right.reasoning,
    total: left.total + right.total,
  };
}

function addRecord(summary: AiUsageSummary, record: AiUsageRecord): AiUsageSummary {
  return {
    records: summary.records + 1,
    tokens: addTokens(summary.tokens, record.tokens),
    cost: summary.cost + (record.cost ?? 0),
  };
}

export function emptyAiUsageSummary(): AiUsageSummary {
  return { records: 0, tokens: zeroTokens(), cost: 0 };
}

export function summarizeAiUsage(records: readonly AiUsageRecord[]): AiUsageSummary {
  return records.reduce(addRecord, emptyAiUsageSummary());
}

export function filterAiUsageByDate(records: readonly AiUsageRecord[], filter: AiUsageDateFilter): readonly AiUsageRecord[] {
  return records.filter((record) => {
    if (filter.since !== undefined && record.timestamp < filter.since) {
      return false;
    }
    if (filter.until !== undefined && record.timestamp > filter.until) {
      return false;
    }
    return true;
  });
}

function groupSummary(records: readonly AiUsageRecord[], keyFor: (record: AiUsageRecord) => string): readonly AiUsageBreakdownItem[] {
  const grouped = new Map<string, AiUsageSummary>();
  for (const item of records) {
    const key = keyFor(item);
    grouped.set(key, addRecord(grouped.get(key) ?? emptyAiUsageSummary(), item));
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, summary]) => ({ key, ...summary }));
}

export function summarizeAiUsageBreakdowns(records: readonly AiUsageRecord[]): AiUsageBreakdowns {
  return {
    byClient: groupSummary(records, (record) => record.client),
    byModel: groupSummary(records, (record) => record.model),
    byDay: groupSummary(records, (record) => record.timestamp.slice(0, 10)),
  };
}

export function isWorkspaceInRepo(workspacePath: string | undefined, repoPath: string): boolean {
  if (workspacePath === undefined) {
    return false;
  }
  const normalizedWorkspace = resolve(workspacePath);
  const normalizedRepo = resolve(repoPath);
  if (normalizedWorkspace === normalizedRepo) {
    return true;
  }
  const relativePath = relative(normalizedRepo, normalizedWorkspace);
  return relativePath.length > 0 && !relativePath.startsWith("..") && !relativePath.startsWith("/") && relativePath !== ".";
}

export function filterAiUsageForRepo(records: readonly AiUsageRecord[], repoPath: string): readonly AiUsageRecord[] {
  return records.filter((record) => isWorkspaceInRepo(record.workspacePath, repoPath));
}

export function summarizeAiUsageForRepo(records: readonly AiUsageRecord[], repoPath: string, filter: AiUsageDateFilter = {}): AiUsageProjectSummary {
  const matched = filterAiUsageForRepo(filterAiUsageByDate(records, filter), repoPath);
  return {
    repoPath: resolve(repoPath),
    ...summarizeAiUsage(matched),
    breakdowns: summarizeAiUsageBreakdowns(matched),
  };
}

export function summarizeAiUsageForRepos(records: readonly AiUsageRecord[], repoPaths: readonly string[], filter: AiUsageDateFilter = {}): AiUsageMultiRepoSummary {
  const projects = repoPaths.map((repoPath) => summarizeAiUsageForRepo(records, repoPath, filter));
  const filteredRecords = filterAiUsageByDate(records, filter);
  const matchedRecords = repoPaths.flatMap((repoPath) => filterAiUsageForRepo(filteredRecords, repoPath));
  const matchedTotal: ReportAiUsageProjectSummary = {
    ...projects.reduce<AiUsageSummary>(
      (total, project) => ({ records: total.records + project.records, tokens: addTokens(total.tokens, project.tokens), cost: total.cost + project.cost }),
      emptyAiUsageSummary(),
    ),
    breakdowns: summarizeAiUsageBreakdowns(matchedRecords),
  };
  return { projects, matchedTotal };
}
