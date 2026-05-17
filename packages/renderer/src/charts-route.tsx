import { Card, CardContent, CardHeader, CardTitle } from "@git-snitch/ui/components/card";
import type { ReactNode } from "react";

import type { RepoReportData, ReportData } from "@git-snitch/core";

import {
  ActivityHeatmap,
  AdditionsVsDeletionsChart,
  CodeOwnershipChart,
  CommitActivityChart,
  CommitSizeDistributionChart,
  ContributionCalendar,
  ContributorPieChart,
  LanguageDistributionChart,
  TimeOfDayChart,
  VelocityChart,
  WeeklyActivityChart,
  deriveActivityHeatmapData,
  deriveAdditionsVsDeletionsData,
  deriveCodeOwnershipData,
  deriveCommitActivityData,
  deriveCommitSizeDistributionData,
  deriveContributionCalendarData,
  deriveContributorPieData,
  deriveLanguageDistributionData,
  deriveTimeOfDayData,
  deriveVelocityData,
  deriveWeeklyActivityData,
} from "./charts";
import { EmptyState } from "./empty-state";

type ChartsRouteProps = {
  readonly report: ReportData;
};

function repoDataMismatch() {
  return (
    <EmptyState
      title="Charts are unavailable for scan reports"
      description="This route expects a single-repository report. Open a scan route for multi-repository data once scan report routes are available."
    />
  );
}

function hasChartableActivity(report: RepoReportData) {
  return (
    report.commits.length > 0 ||
    report.contributors.some((contributor) => contributor.commitCount > 0 || contributor.filesChanged > 0) ||
    report.analysis.languages.some((language) => language.lines > 0 || language.files > 0) ||
    report.analysis.cadence.some((point) => point.commits > 0)
  );
}

function ChartsHeader({ report }: { readonly report: RepoReportData }) {
  const hasActivity = hasChartableActivity(report);

  return (
    <section className="grid grid-flow-dense gap-5 rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Charts</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A compact visual read of cadence, churn, ownership, and timing. The layout keeps related evidence together instead of turning every metric into a competing dashboard tile.
        </p>
      </div>
      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Visual scope</p>
        <p className="mt-2 text-sm font-medium text-foreground">{hasActivity ? "Repository activity is chartable." : "No chartable activity yet."}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Charts use only the injected standalone report payload.</p>
      </div>
    </section>
  );
}

function SectionFrame({ title, description, children }: { readonly title: string; readonly description: string; readonly children: ReactNode }) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b border-border/60 bg-muted/25">
        <CardTitle className="text-lg font-semibold tracking-tight text-foreground">{title}</CardTitle>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function SparseRepositoryNotice({ report }: { readonly report: RepoReportData }) {
  if (hasChartableActivity(report)) {
    return null;
  }

  return (
    <EmptyState
      title="This repository has no chartable activity yet"
      description="Commit, contributor, language, and cadence data are all empty for this branch scope. Each chart below explains the specific data it needs."
    />
  );
}

export function ChartsRoute({ report }: ChartsRouteProps) {
  if (report.kind !== "repo") {
    return repoDataMismatch();
  }

  const activity = deriveCommitActivityData(report);
  const churn = deriveAdditionsVsDeletionsData(report.commits);
  const sizes = deriveCommitSizeDistributionData(report.commits);
  const languages = deriveLanguageDistributionData(report);
  const calendar = deriveContributionCalendarData(report.commits);
  const velocity = deriveVelocityData(report);
  const ownership = deriveCodeOwnershipData(report.contributors);
  const heatmap = deriveActivityHeatmapData(report.commits);
  const timeOfDay = deriveTimeOfDayData(report.commits);
  const contributorShare = deriveContributorPieData(report.contributors);
  const weeklyActivity = deriveWeeklyActivityData(report.commits);
  const showContributorShare = contributorShare.length > 1;

  return (
    <div className="grid gap-6">
      <ChartsHeader report={report} />
      <SparseRepositoryNotice report={report} />

      <SectionFrame title="Cadence and churn" description="Start with the signals that establish tempo before drilling into ownership or hourly behavior.">
        <div className="grid grid-flow-dense gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <CommitActivityChart data={activity} />
          </div>
          <div className="xl:col-span-5">
            <VelocityChart data={velocity} />
          </div>
          <div className="xl:col-span-7">
            <AdditionsVsDeletionsChart data={churn} />
          </div>
          <div className="xl:col-span-5">
            <CommitSizeDistributionChart data={sizes} />
          </div>
        </div>
      </SectionFrame>

      <SectionFrame title="Activity rhythm" description="Temporal views reveal when work actually happens without mixing the timeline with unrelated repository totals.">
        <div className="grid grid-flow-dense gap-5 lg:grid-cols-2">
          <TimeOfDayChart data={timeOfDay} />
          {showContributorShare ? <ContributorPieChart data={contributorShare} /> : <WeeklyActivityChart data={weeklyActivity} />}
          <div className="lg:col-span-2">
            <ActivityHeatmap data={heatmap} />
          </div>
        </div>
      </SectionFrame>

      <SectionFrame title="Repository shape" description="The final group stays focused on source mix, ownership footprint, and day-level density.">
        <div className="grid grid-flow-dense gap-5 lg:grid-cols-3">
          <LanguageDistributionChart data={languages} />
          <CodeOwnershipChart data={ownership} />
          <ContributionCalendar data={calendar} />
        </div>
      </SectionFrame>
    </div>
  );
}
