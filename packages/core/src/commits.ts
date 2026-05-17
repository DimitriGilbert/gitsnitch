import type { IsoDateString } from "./json.js";

export type CommitClassification =
  | "feature"
  | "fix"
  | "bugfix"
  | "docs"
  | "refactor"
  | "test"
  | "chore"
  | "style"
  | "perf"
  | "ci"
  | "build"
  | "revert"
  | "merge"
  | "release"
  | "other";

export interface CommitAuthor {
  readonly name: string;
  readonly email: string;
}

export interface CommitFileChange {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  readonly status: "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";
  readonly previousPath?: string;
}

export interface CommitRecord {
  readonly hash: string;
  readonly shortHash: string;
  readonly message: string;
  readonly body?: string;
  readonly author: CommitAuthor;
  readonly authoredAt: IsoDateString;
  readonly committedAt: IsoDateString;
  readonly parents: readonly string[];
  readonly refs: readonly string[];
  readonly classification: CommitClassification;
  readonly files: readonly CommitFileChange[];
}
