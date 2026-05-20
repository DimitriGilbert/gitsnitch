import { Card, CardContent, CardHeader, CardTitle } from "@git-snitch/ui/components/card";

import type { CommitRecord, GitHubRepoMeta, RepoReportData, ReportData } from "@git-snitch/core";

import { AiUsagePanel } from "./ai-usage.js";
import { CommitActivityChart, deriveCommitActivityData } from "./charts.js";
import { EmptyState } from "./empty-state.js";
import { StatsGrid } from "./layout.js";

type StreakSummary =
  | {
      readonly status: "ready";
      readonly current: number;
      readonly longest: number;
      readonly anchorDate: string;
    }
  | { readonly status: "empty" }
  | { readonly status: "insufficient-dates" };

function parseCommitDay(commit: CommitRecord) {
  const timestamp = Date.parse(commit.authoredAt);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function nextUtcDay(day: string) {
  const timestamp = Date.parse(`${day}T00:00:00.000Z`);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp + 86_400_000).toISOString().slice(0, 10);
}

export function deriveStreakSummary(commits: readonly CommitRecord[]): StreakSummary {
  if (commits.length === 0) {
    return { status: "empty" };
  }

  const days = [...new Set(commits.map(parseCommitDay).filter((day): day is string => day !== undefined))].sort();

  if (days.length === 0) {
    return { status: "insufficient-dates" };
  }

  let longest = 1;
  let active = 1;

  for (let index = 1; index < days.length; index += 1) {
    const previousDay = days[index - 1];
    const currentDay = days[index];

    if (previousDay && currentDay && nextUtcDay(previousDay) === currentDay) {
      active += 1;
    } else {
      active = 1;
    }

    longest = Math.max(longest, active);
  }

  let current = 1;
  for (let index = days.length - 1; index > 0; index -= 1) {
    const previousDay = days[index - 1];
    const currentDay = days[index];

    if (previousDay && currentDay && nextUtcDay(previousDay) === currentDay) {
      current += 1;
    } else {
      break;
    }
  }

  return { status: "ready", current, longest, anchorDate: days[days.length - 1] ?? "" };
}

function totalAdditions(report: RepoReportData) {
  return report.commits.reduce((sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.additions, 0), 0);
}

function totalDeletions(report: RepoReportData) {
  return report.commits.reduce((sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.deletions, 0), 0);
}

function totalLinesOfCode(report: RepoReportData) {
  return report.analysis.languages.reduce((sum, language) => sum + language.lines, 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function GitHubMetaBar({ meta }: { readonly meta: GitHubRepoMeta }) {
  const items: readonly string[] = [
    ...(meta.stars !== undefined && meta.stars > 0 ? [`Stars ${formatCompact(meta.stars)}`] : []),
    ...(meta.forks !== undefined && meta.forks > 0 ? [`Forks ${formatCompact(meta.forks)}`] : []),
    ...(meta.license !== undefined && meta.license.length > 0 ? [`License ${meta.license}`] : []),
    ...(meta.visibility !== undefined ? [meta.visibility === "private" ? "Private" : "Public"] : []),
    ...(meta.openIssues !== undefined && meta.openIssues > 0 ? [`Issues ${formatCompact(meta.openIssues)}`] : []),
    ...(meta.openPullRequests !== undefined && meta.openPullRequests > 0 ? [`PRs ${formatCompact(meta.openPullRequests)}`] : []),
  ];

  const topics = meta.topics ?? [];

  if (items.length === 0 && topics.length === 0 && meta.homepageUrl === undefined) {
    return null;
  }

  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/50 bg-muted/25 px-4 py-3">
      {items.map((item) => {
        const spaceIndex = item.indexOf(" ");
        const label = spaceIndex >= 0 ? item.slice(0, spaceIndex) : item;
        const value = spaceIndex >= 0 ? item.slice(spaceIndex + 1) : undefined;
        return (
          <span key={item} className="text-sm text-muted-foreground">
            {label}{value !== undefined ? (<>
{" "}<strong className="font-medium text-foreground">{value}</strong>
</>) : null}
          </span>
        );
      })}
      {meta.homepageUrl !== undefined && meta.homepageUrl.length > 0 ? (
        <a
          className="text-sm text-muted-foreground hover:text-foreground"
          href={meta.homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Homepage
        </a>
      ) : null}
      {topics.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {topics.map((topic) => (
            <span key={topic} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{topic}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function buildOverviewStats(report: RepoReportData) {
  return [
    { label: "Total commits", value: formatNumber(report.commits.length), description: "Commits included in this report" },
    { label: "Contributors", value: formatNumber(report.contributors.length), description: "Unique author identities" },
    { label: "Additions", value: formatNumber(totalAdditions(report)), description: "Lines added across file changes" },
    { label: "Deletions", value: formatNumber(totalDeletions(report)), description: "Lines removed across file changes" },
    { label: "LoC", value: formatNumber(totalLinesOfCode(report)), description: "Detected lines of code" },
  ];
}

function StreakCard({ streak }: { readonly streak: StreakSummary }) {
  if (streak.status === "empty") {
    return (
      <EmptyState
        title="No streak data yet"
        description="Streaks appear after the repository has at least one dated commit."
      />
    );
  }

  if (streak.status === "insufficient-dates") {
    return (
      <EmptyState
        title="Streak data is unavailable"
        description="The commits in this report do not include valid authored dates, so streaks cannot be derived."
      />
    );
  }

  return (
    <Card className="h-full overflow-hidden shadow-none transition-transform duration-500 ease-out hover:-translate-y-0.5">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">Commit streak</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">Consecutive UTC commit days ending at the latest commit in this report.</p>
      </CardHeader>
      <CardContent className="grid grid-flow-dense gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Current</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{streak.current}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Ending {streak.anchorDate}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Longest</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{streak.longest}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Best consecutive-day run</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartPreview({ report }: { readonly report: RepoReportData }) {
  const activity = deriveCommitActivityData(report);

  if (activity.length === 0 || activity.every((point) => point.commits === 0)) {
    return (
      <EmptyState
        title="No activity preview yet"
        description="The mini chart needs at least one cadence point with commits."
      />
    );
  }

  return <CommitActivityChart data={activity} />;
}

export function RepoOverview({ report }: { readonly report: ReportData }) {
  if (report.kind !== "repo") {
    return (
      <EmptyState
        title="Repo overview is unavailable for scan reports"
        description="This route expects a single-repository report. Open the scan overview for multi-repository aggregate evidence."
      />
    );
  }

  const githubMeta = report.repository.github;

  if (report.commits.length === 0 && report.contributors.length === 0) {
    return (
      <div className="grid gap-6">
        <StatsGrid stats={buildOverviewStats(report)} />
        {githubMeta !== undefined ? <GitHubMetaBar meta={githubMeta} /> : null}
        {report.aiUsage !== undefined ? <AiUsagePanel usage={report.aiUsage} /> : null}
        <EmptyState
          title="This repository has no commit activity yet"
          description="git-snitch found a repository report, but there are no commits or contributors to summarize. Charts and streaks will appear after activity exists."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <StatsGrid stats={buildOverviewStats(report)} />
      {githubMeta !== undefined ? <GitHubMetaBar meta={githubMeta} /> : null}
      {report.aiUsage !== undefined ? <AiUsagePanel usage={report.aiUsage} /> : null}
      <section aria-label="Repository overview previews" className="grid grid-flow-dense gap-6 lg:grid-cols-2">
        <StreakCard streak={deriveStreakSummary(report.commits)} />
        <ChartPreview report={report} />
      </section>
    </div>
  );
}
