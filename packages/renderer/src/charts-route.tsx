import type { ReactNode } from "react";

import type { RepoReportData, ReportData } from "@git-snitch/core";

import {
  ActivityHeatmap,
  AdditionsVsDeletionsChart,
  AiUsageBreakdownChart,
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
  deriveAiUsageBreakdownData,
  deriveCodeOwnershipData,
  deriveCommitActivityData,
  deriveCommitSizeDistributionData,
  deriveContributionCalendarData,
  deriveContributorPieData,
  deriveLanguageDistributionData,
  deriveTimeOfDayData,
  deriveVelocityData,
  deriveWeeklyActivityData,
} from "./charts.js";
import { EmptyState } from "./empty-state.js";
import { Section, SectionHeader, SectionStat } from "./section.js";

type ChartsRouteProps = {
  readonly report: ReportData;
};

function repoDataMismatch() {
  return (
    <EmptyState
      title="Charts are unavailable for scan reports"
      description="This route expects a single-repository report. Open the scan overview for multi-repository aggregate evidence."
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
    <Section className="md:grid md:grid-flow-dense md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
      <SectionHeader
        title="Charts"
        description="A compact visual read of cadence, churn, ownership, and timing. The layout keeps related evidence together instead of turning every metric into a competing dashboard tile."
      />
      <SectionStat
        label="Visual scope"
        value={hasActivity ? "Repository activity is chartable." : "No chartable activity yet."}
        description="Charts use only the injected standalone report payload."
      />
    </Section>
  );
}

function SectionFrame({ title, description, children }: { readonly title: string; readonly description: string; readonly children: ReactNode }) {
  return (
    <Section>
      <SectionHeader title={title} description={description} />
      {children}
    </Section>
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
  const aiUsageByModel = deriveAiUsageBreakdownData(report.aiUsage?.breakdowns.byModel ?? []);
  const aiUsageByHarness = deriveAiUsageBreakdownData(report.aiUsage?.breakdowns.byClient ?? []);
  const showContributorShare = contributorShare.length > 1;

  return (
    <div className="grid gap-5">
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

      {report.aiUsage !== undefined ? (
        <SectionFrame title="AI usage" description="Model and harness usage from matched local assistant logs. These charts stay scoped to this repository report payload.">
          <div className="grid grid-flow-dense gap-5 lg:grid-cols-2">
            <AiUsageBreakdownChart title="AI usage by model" description="Matched assistant tokens and messages grouped by model." data={aiUsageByModel} />
            <AiUsageBreakdownChart title="AI usage by harness" description="Matched assistant tokens and messages grouped by local harness or client." data={aiUsageByHarness} />
          </div>
        </SectionFrame>
      ) : null}
    </div>
  );
}
