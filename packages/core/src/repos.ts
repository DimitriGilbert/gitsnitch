import type { GitHubRepoMeta } from "./git/github.js";
import type { IsoDateString } from "./json.js";

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
  readonly github?: GitHubRepoMeta;
}

export interface ScannedRepositorySummary extends RepositorySummary {
  readonly id: string;
  readonly relativePath: string;
}
