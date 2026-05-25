import { Button } from "@git-snitch/ui/components/button";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { CommitRecord, ContributorSummary, JsonObject, RepoReportData, ReportData } from "@git-snitch/core";

import {
  CodeOwnershipChart,
  ContributorPieChart,
  deriveCodeOwnershipData,
  deriveContributorPieData,
} from "./charts.js";
import { EmptyState } from "./empty-state.js";
import { downloadJson } from "./export.js";
import { Section, SectionGrid, SectionHeader, SectionStat } from "./section.js";
import { CommitsTable, ContributorsTable } from "./tables.js";
import type { DownloadResult } from "./export.js";

export type JsonDownloadResult = DownloadResult;
export type JsonDownloader = (filename: string, rows: readonly JsonObject[]) => JsonDownloadResult;

type RepoRouteProps = {
  readonly report: ReportData;
  readonly jsonDownloader?: JsonDownloader;
};

type ContributorTimelineSummary =
  | {
      readonly status: "ready";
      readonly firstDate: string;
      readonly lastDate: string;
      readonly activeDays: number;
      readonly latestContributor: string;
    }
  | { readonly status: "empty" }
  | { readonly status: "insufficient-dates" };

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function dayKey(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString().slice(0, 10);
}

function daysBetweenInclusive(firstDate: string, lastDate: string) {
  const first = Date.parse(`${firstDate}T00:00:00.000Z`);
  const last = Date.parse(`${lastDate}T00:00:00.000Z`);
  return Math.floor((last - first) / 86_400_000) + 1;
}

function repoDataMismatch(title: string) {
  return (
    <EmptyState
      title={title}
      description="This route expects a single-repository report. Open the scan overview for multi-repository aggregate evidence."
    />
  );
}

function repoFilename(report: RepoReportData, suffix: string) {
  const safeName = report.repository.name.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, "-").replaceAll(/^-|-$/g, "");
  return `${safeName.length > 0 ? safeName : "repo"}-${suffix}`;
}

function commitAdditions(commit: CommitRecord) {
  return commit.files.reduce((sum, file) => sum + file.additions, 0);
}

function commitDeletions(commit: CommitRecord) {
  return commit.files.reduce((sum, file) => sum + file.deletions, 0);
}

function commitToJsonRow(commit: CommitRecord): JsonObject {
  return {
    hash: commit.hash,
    shortHash: commit.shortHash,
    message: commit.message,
    authorName: commit.author.name,
    authorEmail: commit.author.email,
    authoredAt: commit.authoredAt,
    committedAt: commit.committedAt,
    classification: commit.classification,
    additions: commitAdditions(commit),
    deletions: commitDeletions(commit),
    files: commit.files.map((file) => file.path),
    refs: commit.refs,
  };
}

function contributorToJsonRow(contributor: ContributorSummary): JsonObject {
  return {
    name: contributor.name,
    email: contributor.email,
    commitCount: contributor.commitCount,
    additions: contributor.additions,
    deletions: contributor.deletions,
    filesChanged: contributor.filesChanged,
    firstCommitAt: contributor.firstCommitAt ?? null,
    lastCommitAt: contributor.lastCommitAt ?? null,
  };
}

function defaultJsonDownloader(filename: string, rows: readonly JsonObject[]) {
  return downloadJson(filename, rows);
}

function JsonExportButton({ filename, rows, downloader }: { readonly filename: string; readonly rows: readonly JsonObject[]; readonly downloader?: JsonDownloader }) {
  const [status, setStatus] = useState<string | undefined>();
  const canExport = rows.length > 0;

  function handleExport() {
    if (!canExport) {
      return;
    }

    const result = (downloader ?? defaultJsonDownloader)(filename, rows);
    setStatus(result.status === "downloaded" ? "JSON export started." : result.reason);
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={!canExport}>
        Export JSON
      </Button>
      {status ? <p className="text-xs text-muted-foreground" aria-live="polite">{status}</p> : null}
    </div>
  );
}

function RouteHeader({ title, description, action }: { readonly title: string; readonly description: string; readonly action?: ReactNode }) {
  return (
    <Section>
      <SectionHeader title={title} description={description}>{action}</SectionHeader>
    </Section>
  );
}

function CommitsSummary({ commits }: { readonly commits: readonly CommitRecord[] }) {
  const touchedFiles = new Set(commits.flatMap((commit) => commit.files.map((file) => file.path))).size;
  const additions = commits.reduce((sum, commit) => sum + commitAdditions(commit), 0);
  const deletions = commits.reduce((sum, commit) => sum + commitDeletions(commit), 0);

  return (
    <Section ariaLabel="Commit ledger summary">
      <SectionGrid cols={3}>
        <SectionStat label="Touched files" value={formatNumber(touchedFiles)} description="Unique paths changed by visible commits." />
        <SectionStat label="Additions" value={formatNumber(additions)} description="Lines added across commit file stats." />
        <SectionStat label="Deletions" value={formatNumber(deletions)} description="Lines removed across commit file stats." />
      </SectionGrid>
    </Section>
  );
}

function ContributorsComparison({ contributors }: { readonly contributors: readonly ContributorSummary[] }) {
  const contributorShare = deriveContributorPieData(contributors);
  const ownership = deriveCodeOwnershipData(contributors);

  if (contributorShare.length === 0 && ownership.length === 0) {
    return <EmptyState title="No contributor comparison yet" description="Comparison visuals need contributor commit, file, or churn activity." />;
  }

  return (
    <Section ariaLabel="Contributor comparison visuals">
      <SectionGrid cols={2}>
        <ContributorPieChart data={contributorShare} />
        <CodeOwnershipChart data={ownership} />
      </SectionGrid>
    </Section>
  );
}

export function deriveContributorTimelineSummary(contributors: readonly ContributorSummary[]): ContributorTimelineSummary {
  if (contributors.length === 0) {
    return { status: "empty" };
  }

  const datedContributors = contributors
    .map((contributor) => ({ contributor, firstDate: dayKey(contributor.firstCommitAt), lastDate: dayKey(contributor.lastCommitAt) }))
    .filter((entry): entry is { readonly contributor: ContributorSummary; readonly firstDate: string; readonly lastDate: string } => entry.firstDate !== undefined && entry.lastDate !== undefined)
    .sort((left, right) => left.lastDate.localeCompare(right.lastDate));

  if (datedContributors.length === 0) {
    return { status: "insufficient-dates" };
  }

  const firstDate = datedContributors.reduce((earliest, entry) => entry.firstDate < earliest ? entry.firstDate : earliest, datedContributors[0]?.firstDate ?? "");
  const latest = datedContributors[datedContributors.length - 1];

  if (latest === undefined) {
    return { status: "insufficient-dates" };
  }

  return {
    status: "ready",
    firstDate,
    lastDate: latest.lastDate,
    activeDays: daysBetweenInclusive(firstDate, latest.lastDate),
    latestContributor: latest.contributor.name,
  };
}

function ContributorTimeline({ contributors }: { readonly contributors: readonly ContributorSummary[] }) {
  const summary = deriveContributorTimelineSummary(contributors);

  if (summary.status === "empty") {
    return <EmptyState title="No contributor timeline yet" description="Timeline summary appears once at least one contributor exists." />;
  }

  if (summary.status === "insufficient-dates") {
    return <EmptyState title="Contributor timeline is unavailable" description="Contributor rows do not include valid first and last commit dates." />;
  }

  return (
    <Section ariaLabel="Contributor activity timeline">
      <SectionGrid cols={3}>
        <SectionStat label="Activity span" value={`${formatNumber(summary.activeDays)} days`} description={`${summary.firstDate} through ${summary.lastDate}.`} />
        <SectionStat label="Latest contributor" value={summary.latestContributor} description="Contributor with the most recent recorded commit." />
        <SectionStat label="Tracked people" value={formatNumber(contributors.length)} description="Contributor identities in this repository report." />
      </SectionGrid>
    </Section>
  );
}

export function CommitsRoute({ report, jsonDownloader }: RepoRouteProps) {
  const jsonRows = useMemo(() => report.kind === "repo" ? report.commits.map(commitToJsonRow) : [], [report]);

  if (report.kind !== "repo") {
    return repoDataMismatch("Commits are unavailable for scan reports");
  }

  const hasCommits = report.commits.length > 0;

  return (
    <div className="grid gap-5">
      <RouteHeader
        title="Commits ledger"
        description="Searchable, sortable commit evidence with line churn and file context preserved for standalone reports."
        action={hasCommits ? <JsonExportButton filename={repoFilename(report, "commits.json")} rows={jsonRows} downloader={jsonDownloader} /> : undefined}
      />
      {hasCommits ? <CommitsSummary commits={report.commits} /> : null}
      <CommitsTable commits={report.commits} exportFilename={repoFilename(report, "commits.csv")} remoteUrl={report.repository.remoteUrl} />
    </div>
  );
}

export function ContributorsRoute({ report, jsonDownloader }: RepoRouteProps) {
  const jsonRows = useMemo(() => report.kind === "repo" ? report.contributors.map(contributorToJsonRow) : [], [report]);

  if (report.kind !== "repo") {
    return repoDataMismatch("Contributors are unavailable for scan reports");
  }

  const hasContributors = report.contributors.length > 0;

  return (
    <div className="grid gap-5">
      <RouteHeader
        title="Contributors"
        description="A contributor-first view of ownership, recent activity, and exportable identity-level report data."
        action={hasContributors ? <JsonExportButton filename={repoFilename(report, "contributors.json")} rows={jsonRows} downloader={jsonDownloader} /> : undefined}
      />
      <ContributorsComparison contributors={report.contributors} />
      <ContributorTimeline contributors={report.contributors} />
      <ContributorsTable contributors={report.contributors} exportFilename={repoFilename(report, "contributors.csv")} />
    </div>
  );
}
