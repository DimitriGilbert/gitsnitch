import type { IsoDateString } from "./json";

export interface RepositoryIdentity {
  readonly name: string;
  readonly path: string;
  readonly rootPath: string;
  readonly currentBranch?: string;
  readonly remoteUrl?: string;
}

export interface RepositorySummary extends RepositoryIdentity {
  readonly firstCommitAt?: IsoDateString;
  readonly lastCommitAt?: IsoDateString;
  readonly totalCommits: number;
  readonly totalContributors: number;
}

export interface ScannedRepositorySummary extends RepositorySummary {
  readonly id: string;
  readonly relativePath: string;
}
