import type { IsoDateString } from "./json.js";

export interface ContributorIdentity {
  readonly name: string;
  readonly email: string;
}

export interface ContributorSummary extends ContributorIdentity {
  readonly commitCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly filesChanged: number;
  readonly firstCommitAt?: IsoDateString;
  readonly lastCommitAt?: IsoDateString;
}
