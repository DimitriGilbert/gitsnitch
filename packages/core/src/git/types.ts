import type { CommitRecord } from "../commits.js";
import type { RepositoryIdentity } from "../repos.js";

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

export interface CommandFailure extends Error {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
}

export type AsyncCommandRunner = (command: string, args: readonly string[], options: CommandRunnerOptions) => Promise<CommandResult>;

export interface CommandRunnerOptions {
  readonly cwd: string;
}

export interface GitLogOptions {
  readonly repoPath: string;
  readonly runner: AsyncCommandRunner;
  readonly since?: string;
  readonly until?: string;
  readonly branches?: readonly string[];
  readonly allBranches?: boolean;
}

export interface RepositoryInfoOptions {
  readonly repoPath: string;
  readonly runner: AsyncCommandRunner;
}

export interface CommitBranchLookupOptions {
  readonly repoPath: string;
  readonly commitHash: string;
  readonly runner: AsyncCommandRunner;
}

export interface DiscoverRepositoriesOptions {
  readonly maxDepth?: number;
  readonly exclude?: readonly string[];
}

export interface DiscoveredRepository {
  readonly path: string;
  readonly relativePath: string;
}

export interface LineCountByLanguage {
  readonly language: string;
  readonly files: number;
  readonly source: number;
  readonly blank: number;
  readonly comment: number;
  readonly total: number;
}

export interface LineCountSkippedFile {
  readonly path: string;
  readonly reason: "unknown-language" | "unreadable";
}

export interface LineCountResult {
  readonly totalSource: number;
  readonly totalBlank: number;
  readonly totalComment: number;
  readonly totalLines: number;
  readonly byLanguage: readonly LineCountByLanguage[];
  readonly skippedFiles: readonly LineCountSkippedFile[];
}

export interface CountLinesOfCodeOptions {
  readonly exclude?: readonly string[];
}

export interface GitOperations {
  readonly getGitCommits: (options: GitLogOptions) => Promise<readonly CommitRecord[]>;
  readonly getRepositoryInfo: (options: RepositoryInfoOptions) => Promise<RepositoryIdentity>;
  readonly getCurrentBranch: (options: RepositoryInfoOptions) => Promise<string | undefined>;
  readonly getCommitBranches: (options: CommitBranchLookupOptions) => Promise<readonly string[]>;
}
