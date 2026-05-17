export interface LanguageStat {
  readonly language: string;
  readonly files: number;
  readonly lines: number;
}

export interface FileHotspot {
  readonly path: string;
  readonly changeCount: number;
  readonly contributorCount: number;
  readonly churn: number;
}

export interface CommitCadencePoint {
  readonly period: string;
  readonly commits: number;
}

export interface QualitySignal {
  readonly id: string;
  readonly label: string;
  readonly severity: "info" | "warning" | "critical";
  readonly value: number;
  readonly summary: string;
}

export interface RepositoryAnalysis {
  readonly languages: readonly LanguageStat[];
  readonly hotspots: readonly FileHotspot[];
  readonly cadence: readonly CommitCadencePoint[];
  readonly qualitySignals: readonly QualitySignal[];
}

export interface ScanAnalysis {
  readonly totalCommits: number;
  readonly totalContributors: number;
  readonly totalRepositories: number;
  readonly languages: readonly LanguageStat[];
  readonly qualitySignals: readonly QualitySignal[];
}
