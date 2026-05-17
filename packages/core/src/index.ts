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
} from "./analysis.js";
export type { CommitMessageQuality, CommitTypeBreakdown } from "./commit-classifier.js";
export type { CommitAuthor, CommitClassification, CommitFileChange, CommitRecord } from "./commits.js";
export type { GitSnitchConfig, GitSnitchConfigOverrides } from "./config.js";
export type { ContributorIdentity, ContributorSummary } from "./contributors.js";
export type { IsoDateString, JsonArray, JsonObject, JsonPrimitive, JsonValue } from "./json.js";
export type { RepoReportOptions, ReportOptions, ScanOptions, ScanPeriodOptions, ScanReportOptions } from "./options.js";
export type { GenerateScanReportOptions, ReportGenerationDependencies } from "./report.js";
export type { RepoReportData, ReportData, ScanProjectReport, ScanReportData } from "./report-data.js";
export type { RepositoryIdentity, RepositorySummary, ScannedRepositorySummary } from "./repos.js";
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
} from "./git/types.js";
export type {
  RepoTemplateContext,
  RepoTemplateRouteId,
  ScanProjectTemplateContext,
  ScanTemplateContext,
  ScanTemplateRouteId,
  TemplateExportHelpers,
  TemplateRouteId,
} from "./templates.js";

export {
  GitSnitchConfigError,
  getDefaultGitSnitchConfig,
  gitSnitchConfigSchema,
  loadGitSnitchConfig,
  mergeGitSnitchConfig,
} from "./config.js";
export {
  DEFAULT_SCAN_EXCLUDE_PATTERNS,
  DEFAULT_SCAN_INCLUDE_PATTERNS,
  DEFAULT_SCAN_MAX_DEPTH,
  isoDateStringSchema,
  repoReportOptionsSchema,
  scanPeriodOptionsSchema,
  scanOptionsSchema,
  scanReportOptionsSchema,
} from "./options.js";
export { generateRepoReport, generateScanReport, GitSnitchReportError, parseScanPeriod } from "./report.js";
export { isRepoReportData, isScanReportData, reportDataDiscriminantSchema, reportKindSchema } from "./report-data.js";
export { analyzeCommitMessageQuality, classifyCommit, generateCommitTypeBreakdown } from "./commit-classifier.js";
export { discoverGitRepositories } from "./git/discovery.js";
export { buildGitLogArgs, getGitCommits } from "./git/log.js";
export { countLinesOfCode } from "./git/loc.js";
export { getCommitBranches, getCurrentBranch, getRepositoryInfo, normalizeRemoteUrl } from "./git/repository.js";
export { createGitCommandRunner } from "./git/runner.js";
export { calculateRiskLevel, findFileHotspots } from "./hotspots.js";
export {
  analyzeDevelopmentRhythm,
  calculateCollaborationScore,
  calculateFocusTime,
  calculateVelocity,
  findPeakDays,
  findPeakHours,
  generateProductivityInsights,
} from "./productivity.js";
export {
  aggregateContributors,
  calculateProjectStats,
  calculateTimingStats,
  filterCommitsByDate,
  generateContributorStats,
  sortCommits,
} from "./analysis.js";
export {
  calculateBusFactor,
  calculateChurnRate,
  calculateCodeQualityMetrics,
  calculateGiniCoefficient,
  calculateHealthScore,
  generateHealthRecommendations,
  getHealthScoreRating,
} from "./quality-metrics.js";
