export type {
  CodeQualityMetrics,
  CodeQualityMetricsWithoutHealthScore,
  CollaborationInsight,
  CollaborationLevel,
  CommitCadencePoint,
  CommitSortKey,
  ContributorAggregateProject,
  DateBoundary,
  DevelopmentConsistency,
  DevelopmentRhythmInsight,
  FileHotspot,
  FileRiskLevel,
  FileRiskLevelName,
  FocusTimeInsight,
  HealthRecommendation,
  HealthRecommendationSeverity,
  HealthScoreRating,
  LanguageStat,
  PeakDayInsight,
  PeakHourInsight,
  ProjectStats,
  ProductivityInsights,
  QualitySignal,
  RepositoryAnalysis,
  ScanAnalysis,
  SortOrder,
  TimingStats,
  VelocityInsight,
  VelocityLevel,
  WorkLifeBalance,
} from "./analysis";
export type { CommitMessageQuality, CommitTypeBreakdown } from "./commit-classifier";
export type { CommitAuthor, CommitClassification, CommitFileChange, CommitRecord } from "./commits";
export type { GitSnitchConfig } from "./config";
export type { ContributorIdentity, ContributorSummary } from "./contributors";
export type { IsoDateString, JsonArray, JsonObject, JsonPrimitive, JsonValue } from "./json";
export type { RepoReportOptions, ReportOptions, ScanOptions, ScanReportOptions } from "./options";
export type { RepoReportData, ReportData, ScanProjectReport, ScanReportData } from "./report-data";
export type { RepositoryIdentity, RepositorySummary, ScannedRepositorySummary } from "./repos";
export type {
  AsyncCommandRunner,
  CommandResult,
  CountLinesOfCodeOptions,
  DiscoverRepositoriesOptions,
  DiscoveredRepository,
  GitLogOptions,
  LineCountByLanguage,
  LineCountResult,
  LineCountSkippedFile,
} from "./git/types";
export type {
  RepoTemplateContext,
  RepoTemplateRouteId,
  ScanProjectTemplateContext,
  ScanTemplateContext,
  ScanTemplateRouteId,
  TemplateExportHelpers,
  TemplateRouteId,
} from "./templates";

export { gitSnitchConfigSchema } from "./config";
export {
  DEFAULT_SCAN_EXCLUDE_PATTERNS,
  DEFAULT_SCAN_INCLUDE_PATTERNS,
  DEFAULT_SCAN_MAX_DEPTH,
  isoDateStringSchema,
  repoReportOptionsSchema,
  scanOptionsSchema,
  scanReportOptionsSchema,
} from "./options";
export { isRepoReportData, isScanReportData, reportDataDiscriminantSchema, reportKindSchema } from "./report-data";
export { analyzeCommitMessageQuality, classifyCommit, generateCommitTypeBreakdown } from "./commit-classifier";
export { discoverGitRepositories } from "./git/discovery";
export { buildGitLogArgs, getGitCommits } from "./git/log";
export { countLinesOfCode } from "./git/loc";
export { getCommitBranches, getCurrentBranch, getRepositoryInfo, normalizeRemoteUrl } from "./git/repository";
export { createGitCommandRunner } from "./git/runner";
export { calculateRiskLevel, findFileHotspots } from "./hotspots";
export {
  analyzeDevelopmentRhythm,
  calculateCollaborationScore,
  calculateFocusTime,
  calculateVelocity,
  findPeakDays,
  findPeakHours,
  generateProductivityInsights,
} from "./productivity";
export {
  aggregateContributors,
  calculateProjectStats,
  calculateTimingStats,
  filterCommitsByDate,
  generateContributorStats,
  sortCommits,
} from "./analysis";
export {
  calculateBusFactor,
  calculateChurnRate,
  calculateCodeQualityMetrics,
  calculateGiniCoefficient,
  calculateHealthScore,
  generateHealthRecommendations,
  getHealthScoreRating,
} from "./quality-metrics";
