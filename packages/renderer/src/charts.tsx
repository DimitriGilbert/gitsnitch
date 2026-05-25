import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@git-snitch/ui/components/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@git-snitch/ui/components/card";
import { cn } from "@git-snitch/ui/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

import type { AiUsageBreakdownItem, CommitRecord, ContributorSummary, RepoReportData, ReportAiUsageProjectSummary, ScanProjectReport, ScanReportData } from "@git-snitch/core";

import { EmptyState } from "./empty-state.js";

const chartPalette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;
const shortWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const staticChartProps = { isAnimationActive: false } as const;
type Weekday = (typeof shortWeekdays)[number];

export type CommitActivityPoint = { readonly period: string; readonly commits: number };
export type ContributorPieSlice = { readonly name: string; readonly commits: number };
export type LanguageDistributionSlice = { readonly language: string; readonly lines: number; readonly files: number };
export type AdditionsVsDeletionsPoint = { readonly period: string; readonly additions: number; readonly deletions: number };
export type CommitSizeBucket = { readonly label: string; readonly commits: number };
export type WeeklyActivityPoint = { readonly day: string; readonly commits: number };
export type TimeOfDayPoint = { readonly hour: string; readonly commits: number };
export type ContributionCalendarDay = { readonly date: string; readonly commits: number };
export type VelocityPoint = { readonly period: string; readonly commits: number; readonly average: number };
export type CodeOwnershipPoint = { readonly owner: string; readonly additions: number; readonly deletions: number; readonly filesChanged: number };
export type ProjectComparisonPoint = { readonly project: string; readonly commits: number; readonly contributors: number; readonly filesChanged: number };
export type ActivityHeatmapCell = { readonly day: string; readonly hour: string; readonly commits: number };
export type AiUsageBreakdownPoint = { readonly name: string; readonly messages: number; readonly inputTokens: number; readonly outputTokens: number; readonly cacheTokens: number; readonly tokens: number; readonly cost: number };
export type ScanCommitSlice = { readonly name: string; readonly commits: number };
export type ScanChurnSlice = { readonly name: string; readonly additions: number; readonly deletions: number; readonly churn: number };
export type ScanAiProjectSlice = { readonly name: string; readonly messages: number; readonly inputTokens: number; readonly outputTokens: number; readonly cacheTokens: number; readonly tokens: number };
export type ScanAiModelSlice = { readonly name: string; readonly messages: number; readonly inputTokens: number; readonly outputTokens: number; readonly cacheTokens: number; readonly tokens: number };

type ChartPanelProps = {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly isEmpty: boolean;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
};

function ChartPanel({ title, description, children, isEmpty, emptyTitle, emptyDescription }: ChartPanelProps) {
  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">{title}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function hasPositiveValue<T>(data: readonly T[], select: (item: T) => readonly number[]) {
  return data.some((item) => select(item).some((value) => value > 0));
}

function parseIsoDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function weekdayForDate(date: Date): Weekday {
  return shortWeekdays[date.getUTCDay()] ?? "Sun";
}

export function deriveCommitActivityData(report: Pick<RepoReportData, "analysis">): readonly CommitActivityPoint[] {
  return report.analysis.cadence.map((point) => ({ period: point.period, commits: point.commits }));
}

export function deriveContributorPieData(contributors: readonly ContributorSummary[]): readonly ContributorPieSlice[] {
  return contributors
    .filter((contributor) => contributor.commitCount > 0)
    .map((contributor) => ({ name: contributor.name, commits: contributor.commitCount }))
    .sort((left, right) => right.commits - left.commits || left.name.localeCompare(right.name));
}

export function deriveLanguageDistributionData(report: Pick<RepoReportData | ScanReportData, "analysis">): readonly LanguageDistributionSlice[] {
  return report.analysis.languages
    .filter((language) => language.lines > 0 || language.files > 0)
    .map((language) => ({ language: language.language, lines: language.lines, files: language.files }))
    .sort((left, right) => right.lines - left.lines || left.language.localeCompare(right.language));
}

export function deriveAdditionsVsDeletionsData(commits: readonly CommitRecord[]): readonly AdditionsVsDeletionsPoint[] {
  const periods = new Map<string, { additions: number; deletions: number }>();
  for (const commit of commits) {
    const period = monthKey(commit.authoredAt);
    const current = periods.get(period) ?? { additions: 0, deletions: 0 };
    current.additions += commit.files.reduce((sum, file) => sum + file.additions, 0);
    current.deletions += commit.files.reduce((sum, file) => sum + file.deletions, 0);
    periods.set(period, current);
  }
  return [...periods.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([period, totals]) => ({ period, ...totals }));
}

export function deriveCommitSizeDistributionData(commits: readonly CommitRecord[]): readonly CommitSizeBucket[] {
  const buckets = [
    { label: "0 (empty)", min: 0, max: 0, commits: 0 },
    { label: "1-10", min: 1, max: 10, commits: 0 },
    { label: "11-50", min: 11, max: 50, commits: 0 },
    { label: "51-200", min: 51, max: 200, commits: 0 },
    { label: "201+", min: 201, max: Number.POSITIVE_INFINITY, commits: 0 },
  ];
  for (const commit of commits) {
    const changedLines = commit.files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
    const bucket = buckets.find((candidate) => changedLines >= candidate.min && changedLines <= candidate.max);
    if (bucket) {
      bucket.commits += 1;
    }
  }
  return buckets.map(({ label, commits }) => ({ label, commits }));
}

export function deriveWeeklyActivityData(commits: readonly CommitRecord[]): readonly WeeklyActivityPoint[] {
  const counts = new Map<Weekday, number>(shortWeekdays.map((day) => [day, 0]));
  for (const commit of commits) {
    const date = parseIsoDate(commit.authoredAt);
    if (date) {
      const day = weekdayForDate(date);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }
  return shortWeekdays.map((day) => ({ day, commits: counts.get(day) ?? 0 }));
}

export function deriveTimeOfDayData(commits: readonly CommitRecord[]): readonly TimeOfDayPoint[] {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const commit of commits) {
    const date = parseIsoDate(commit.authoredAt);
    if (date) {
      const hour = date.getUTCHours();
      counts[hour] = (counts[hour] ?? 0) + 1;
    }
  }
  return counts.map((commits, hour) => ({ hour: `${hour.toString().padStart(2, "0")}:00`, commits }));
}

export function deriveContributionCalendarData(commits: readonly CommitRecord[]): readonly ContributionCalendarDay[] {
  if (commits.length === 0) return [];

  const counts = new Map<string, number>();
  let minDate = "";
  let maxDate = "";
  for (const commit of commits) {
    const date = commit.authoredAt.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
    if (minDate === "" || date < minDate) minDate = date;
    if (maxDate === "" || date > maxDate) maxDate = date;
  }

  const result: ContributionCalendarDay[] = [];
  const current = new Date(`${minDate}T00:00:00Z`);
  const end = new Date(`${maxDate}T00:00:00Z`);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({ date: dateStr, commits: counts.get(dateStr) ?? 0 });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

export function deriveVelocityData(report: Pick<RepoReportData, "analysis">): readonly VelocityPoint[] {
  const activity = deriveCommitActivityData(report);
  return activity.map((point, index) => {
    const window = activity.slice(Math.max(0, index - 2), index + 1);
    const average = window.reduce((sum, item) => sum + item.commits, 0) / window.length;
    return { ...point, average: Math.round(average * 10) / 10 };
  });
}

export function deriveCodeOwnershipData(contributors: readonly ContributorSummary[]): readonly CodeOwnershipPoint[] {
  return contributors
    .filter((contributor) => contributor.additions > 0 || contributor.deletions > 0 || contributor.filesChanged > 0)
    .map((contributor) => ({
      owner: contributor.name,
      additions: contributor.additions,
      deletions: contributor.deletions,
      filesChanged: contributor.filesChanged,
    }))
    .sort((left, right) => right.filesChanged - left.filesChanged || left.owner.localeCompare(right.owner));
}

export function deriveProjectsComparisonData(projects: readonly ScanProjectReport[]): readonly ProjectComparisonPoint[] {
  return projects
    .map((project) => ({
      project: project.repository.relativePath,
      commits: project.report.repository.totalCommits,
      contributors: project.report.repository.totalContributors,
      filesChanged: new Set(project.report.commits.flatMap((commit) => commit.files.map((file) => file.path))).size,
    }))
    .sort((left, right) => right.commits - left.commits || left.project.localeCompare(right.project));
}

export function deriveAiUsageBreakdownData(rows: readonly AiUsageBreakdownItem[]): readonly AiUsageBreakdownPoint[] {
  return rows
    .filter((row) => row.records > 0 || row.tokens.total > 0 || row.cost > 0)
    .map((row) => ({ name: row.key, messages: row.records, inputTokens: row.tokens.input, outputTokens: row.tokens.output, cacheTokens: row.tokens.cacheRead + row.tokens.cacheWrite, tokens: row.tokens.total, cost: row.cost }))
    .sort((left, right) => right.tokens - left.tokens || right.messages - left.messages || left.name.localeCompare(right.name))
    .slice(0, 8);
}

export function deriveActivityHeatmapData(commits: readonly CommitRecord[]): readonly ActivityHeatmapCell[] {
  const counts = new Map<string, number>();
  for (const commit of commits) {
    const date = parseIsoDate(commit.authoredAt);
    if (date) {
      const key = `${weekdayForDate(date)}-${date.getUTCHours().toString().padStart(2, "0")}:00`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return shortWeekdays.flatMap((day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const label = `${hour.toString().padStart(2, "0")}:00`;
      return { day, hour: label, commits: counts.get(`${day}-${label}`) ?? 0 };
    }),
  );
}

export function CommitActivityChart({ data }: { readonly data: readonly CommitActivityPoint[] }) {
  return (
    <ChartPanel
      title="Commit activity"
      description="Monthly commit cadence without decorative chrome."
      isEmpty={!hasPositiveValue(data, (item) => [item.commits])}
      emptyTitle="No commit activity to chart"
      emptyDescription="This report has no dated commits, so there is no cadence data yet."
    >
      <ChartContainer config={{ commits: { label: "Commits", color: chartPalette[1] } }} className="h-64 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} />
          <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area type="monotone" dataKey="commits" stroke="var(--color-commits)" fill="var(--color-commits)" fillOpacity={0.18} {...staticChartProps} />
        </AreaChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ContributorPieChart({ data }: { readonly data: readonly ContributorPieSlice[] }) {
  return (
    <ChartPanel
      title="Contributor share"
      description="Commit share by contributor."
      isEmpty={!hasPositiveValue(data, (item) => [item.commits])}
      emptyTitle="No contributor share to chart"
      emptyDescription="Contributor share appears after at least one contributor has commits."
    >
      <ChartContainer config={{ commits: { label: "Commits" } }} className="h-64 w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie data={data} dataKey="commits" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2} {...staticChartProps}>
            {data.map((slice, index) => (
              <Cell key={slice.name} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function LanguageDistributionChart({ data }: { readonly data: readonly LanguageDistributionSlice[] }) {
  return (
    <ChartPanel
      title="Language distribution"
      description="Lines by detected language."
      isEmpty={!hasPositiveValue(data, (item) => [item.lines, item.files])}
      emptyTitle="No language distribution to chart"
      emptyDescription="Language data is unavailable when no source files were counted."
    >
      <ChartContainer config={{ lines: { label: "Lines", color: chartPalette[0] } }} className="h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey="language" type="category" width={96} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="lines" fill="var(--color-lines)" radius={[0, 3, 3, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function AdditionsVsDeletionsChart({ data }: { readonly data: readonly AdditionsVsDeletionsPoint[] }) {
  return (
    <ChartPanel
      title="Additions vs deletions"
      description="Monthly churn split into added and removed lines."
      isEmpty={!hasPositiveValue(data, (item) => [item.additions, item.deletions])}
      emptyTitle="No line churn to chart"
      emptyDescription="This report has no file-level additions or deletions."
    >
      <ChartContainer config={{ additions: { label: "Additions", color: chartPalette[0] }, deletions: { label: "Deletions", color: chartPalette[4] } }} className="h-64 w-full">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} />
          <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="additions" fill="var(--color-additions)" radius={[3, 3, 0, 0]} {...staticChartProps} />
          <Bar dataKey="deletions" fill="var(--color-deletions)" radius={[3, 3, 0, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function CommitSizeDistributionChart({ data }: { readonly data: readonly CommitSizeBucket[] }) {
  return (
    <ChartPanel
      title="Commit size distribution"
      description="Commits grouped by touched lines."
      isEmpty={!hasPositiveValue(data, (item) => [item.commits])}
      emptyTitle="No commit sizes to chart"
      emptyDescription="Commit size distribution needs commits with file-level line changes."
    >
      <ChartContainer config={{ commits: { label: "Commits", color: chartPalette[2] } }} className="h-64 w-full">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="commits" fill="var(--color-commits)" radius={[3, 3, 0, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function WeeklyActivityChart({ data }: { readonly data: readonly WeeklyActivityPoint[] }) {
  return (
    <ChartPanel title="Weekly activity" description="Commits by UTC weekday." isEmpty={!hasPositiveValue(data, (item) => [item.commits])} emptyTitle="No weekly activity to chart" emptyDescription="This activity view needs at least one dated commit.">
      <ChartContainer config={{ commits: { label: "Commits", color: chartPalette[1] } }} className="h-64 w-full">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="commits" fill="var(--color-commits)" radius={[3, 3, 0, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function TimeOfDayChart({ data }: { readonly data: readonly TimeOfDayPoint[] }) {
  return (
    <ChartPanel title="Time of day" description="Commits by UTC hour." isEmpty={!hasPositiveValue(data, (item) => [item.commits])} emptyTitle="No hourly activity to chart" emptyDescription="This activity view needs at least one dated commit.">
      <ChartContainer config={{ commits: { label: "Commits", color: chartPalette[1] } }} className="h-64 w-full">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="hour" tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="commits" fill="var(--color-commits)" radius={[3, 3, 0, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ContributionCalendar({ data }: { readonly data: readonly ContributionCalendarDay[] }) {
  const firstDate = data.length > 0 ? data[0] : undefined;
  const firstDayOffset = firstDate !== undefined
    ? new Date(`${firstDate.date}T00:00:00Z`).getUTCDay()
    : 0;

  return (
    <ChartPanel
      title="Contribution calendar"
      description="Daily commit density."
      isEmpty={!hasPositiveValue(data, (item) => [item.commits])}
      emptyTitle="No contribution calendar to show"
      emptyDescription="The calendar needs at least one dated commit."
    >
      <div className="grid grid-cols-7 gap-1" aria-label="Daily contribution calendar">
        {shortWeekdays.map((day) => (
          <div key={day} className="text-center text-xs text-muted-foreground">{day}</div>
        ))}
        {Array.from({ length: firstDayOffset }, (_, i) => (
          <div key={`offset-${i}`} />
        ))}
        {data.map((day) => (
          <div key={day.date} title={`${day.date}: ${day.commits} commits`} className={cn("h-7 rounded-sm border", heatClass(day.commits))}>
            <span className="sr-only">{`${day.date}: ${day.commits} commits`}</span>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

export function VelocityChart({ data }: { readonly data: readonly VelocityPoint[] }) {
  return (
    <ChartPanel title="Velocity" description="Commit cadence with a three-period rolling average." isEmpty={!hasPositiveValue(data, (item) => [item.commits, item.average])} emptyTitle="No velocity to chart" emptyDescription="Velocity appears after commits exist across dated periods.">
      <ChartContainer config={{ commits: { label: "Commits", color: chartPalette[1] }, average: { label: "Average", color: chartPalette[4] } }} className="h-64 w-full">
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} />
          <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line type="monotone" dataKey="commits" stroke="var(--color-commits)" strokeWidth={2} dot={false} {...staticChartProps} />
          <Line type="monotone" dataKey="average" stroke="var(--color-average)" strokeWidth={2} dot={false} strokeDasharray="4 4" {...staticChartProps} />
        </LineChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function CodeOwnershipChart({ data }: { readonly data: readonly CodeOwnershipPoint[] }) {
  return (
    <ChartPanel title="Code ownership" description="Contributor footprint by changed files and churn." isEmpty={!hasPositiveValue(data, (item) => [item.filesChanged, item.additions, item.deletions])} emptyTitle="No ownership data to chart" emptyDescription="Ownership needs contributor file or churn statistics.">
      <ChartContainer config={{ additions: { label: "Additions", color: chartPalette[0] }, deletions: { label: "Deletions", color: chartPalette[3] }, filesChanged: { label: "Files changed", color: chartPalette[2] } }} className="h-72 w-full">
        <RadarChart data={data} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="owner" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Radar dataKey="filesChanged" stroke="var(--color-filesChanged)" fill="var(--color-filesChanged)" fillOpacity={0.18} {...staticChartProps} />
        </RadarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ProjectsComparisonChart({ data }: { readonly data: readonly ProjectComparisonPoint[] }) {
  return (
    <ChartPanel title="Projects comparison" description="Repository activity across a scan." isEmpty={!hasPositiveValue(data, (item) => [item.commits, item.contributors, item.filesChanged])} emptyTitle="No projects to compare" emptyDescription="Project comparison needs at least one scanned repository with activity.">
      <ChartContainer config={{ commits: { label: "Commits", color: chartPalette[1] }, contributors: { label: "Contributors", color: chartPalette[3] } }} className="h-72 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey="project" type="category" width={112} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="commits" fill="var(--color-commits)" radius={[0, 3, 3, 0]} {...staticChartProps} />
          <Bar dataKey="contributors" fill="var(--color-contributors)" radius={[0, 3, 3, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function AiUsageBreakdownChart({ title, description, data }: { readonly title: string; readonly description: string; readonly data: readonly AiUsageBreakdownPoint[] }) {
  return (
    <ChartPanel title={title} description={description} isEmpty={!hasPositiveValue(data, (item) => [item.messages, item.inputTokens, item.outputTokens, item.cacheTokens])} emptyTitle={`No ${title.toLowerCase()} to chart`} emptyDescription="AI usage charts need matched local assistant records with model or harness metadata.">
      <ChartContainer config={{ inputTokens: { label: "Input", color: chartPalette[0] }, outputTokens: { label: "Output", color: chartPalette[3] }, cacheTokens: { label: "Cache", color: chartPalette[2] }, messages: { label: "Messages", color: chartPalette[4] } }} className="h-72 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={124} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="inputTokens" fill="var(--color-inputTokens)" radius={[0, 3, 3, 0]} {...staticChartProps} />
          <Bar dataKey="outputTokens" fill="var(--color-outputTokens)" radius={[0, 3, 3, 0]} {...staticChartProps} />
          <Bar dataKey="cacheTokens" fill="var(--color-cacheTokens)" radius={[0, 3, 3, 0]} {...staticChartProps} />
          <Bar dataKey="messages" fill="var(--color-messages)" radius={[0, 3, 3, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ActivityHeatmap({ data }: { readonly data: readonly ActivityHeatmapCell[] }) {
  return (
    <ChartPanel title="Activity heatmap" description="UTC weekday and hour density." isEmpty={!hasPositiveValue(data, (item) => [item.commits])} emptyTitle="No activity heatmap to show" emptyDescription="The heatmap needs at least one dated commit.">
      <div className="grid grid-flow-dense grid-cols-[repeat(24,minmax(0,1fr))] gap-1" aria-label="Activity heatmap by day and hour">
        {data.map((cell) => (
          <div key={`${cell.day}-${cell.hour}`} title={`${cell.day} ${cell.hour}: ${cell.commits} commits`} className={cn("h-4 rounded-[2px] border", heatClass(cell.commits))}>
            <span className="sr-only">{`${cell.day} ${cell.hour}: ${cell.commits} commits`}</span>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

export function ScanCommitBarChart({ data }: { readonly data: readonly ScanCommitSlice[] }) {
  return (
    <ChartPanel
      title="Commits per project"
      description="Commit count across scanned repositories."
      isEmpty={!hasPositiveValue(data, (item) => [item.commits])}
      emptyTitle="No commits to chart"
      emptyDescription="Commit comparison needs at least one scanned project with commits."
    >
      <ChartContainer config={{ commits: { label: "Commits", color: chartPalette[1] } }} className="h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="commits" fill="var(--color-commits)" radius={[0, 3, 3, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ScanChurnPieChart({ data }: { readonly data: readonly ScanChurnSlice[] }) {
  return (
    <ChartPanel
      title="Churn per project"
      description="Lines changed (additions + deletions) by project."
      isEmpty={!hasPositiveValue(data, (item) => [item.churn])}
      emptyTitle="No churn to chart"
      emptyDescription="Churn data appears after file-level additions or deletions exist."
    >
      <ChartContainer config={{ churn: { label: "Churn" } }} className="h-64 w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie data={data} dataKey="churn" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2} {...staticChartProps}>
            {data.map((slice, index) => (
              <Cell key={slice.name} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ScanAiMessagesPieChart({ data }: { readonly data: readonly ScanAiProjectSlice[] }) {
  return (
    <ChartPanel
      title="AI messages per project"
      description="Message share across scanned repositories."
      isEmpty={!hasPositiveValue(data, (item) => [item.messages])}
      emptyTitle="No AI messages to chart"
      emptyDescription="AI message data appears after local assistant records are matched to projects."
    >
      <ChartContainer config={{ messages: { label: "Messages" } }} className="h-64 w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie data={data} dataKey="messages" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2} {...staticChartProps}>
            {data.map((slice, index) => (
              <Cell key={slice.name} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ScanAiTokensBarChart({ data }: { readonly data: readonly ScanAiProjectSlice[] }) {
  return (
    <ChartPanel
      title="AI tokens per project"
      description="Input, output, and cached token usage across scanned repositories."
      isEmpty={!hasPositiveValue(data, (item) => [item.inputTokens, item.outputTokens, item.cacheTokens])}
      emptyTitle="No AI tokens to chart"
      emptyDescription="AI token data appears after local assistant records are matched to projects."
    >
      <ChartContainer config={{ inputTokens: { label: "Input", color: chartPalette[0] }, outputTokens: { label: "Output", color: chartPalette[3] }, cacheTokens: { label: "Cache", color: chartPalette[2] } }} className="h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="inputTokens" fill="var(--color-inputTokens)" radius={[0, 3, 3, 0]} {...staticChartProps} />
          <Bar dataKey="outputTokens" fill="var(--color-outputTokens)" radius={[0, 3, 3, 0]} {...staticChartProps} />
          <Bar dataKey="cacheTokens" fill="var(--color-cacheTokens)" radius={[0, 3, 3, 0]} {...staticChartProps} />
        </BarChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function ScanAiModelsPieChart({ data }: { readonly data: readonly ScanAiModelSlice[] }) {
  return (
    <ChartPanel
      title="AI usage by model"
      description="Message share across all models used in the scan."
      isEmpty={!hasPositiveValue(data, (item) => [item.messages])}
      emptyTitle="No AI model data to chart"
      emptyDescription="AI model data appears after local assistant records with model metadata are matched."
    >
      <ChartContainer config={{ messages: { label: "Messages" } }} className="h-64 w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie data={data} dataKey="messages" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2} {...staticChartProps}>
            {data.map((slice, index) => (
              <Cell key={slice.name} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </ChartPanel>
  );
}

export function deriveScanCommitData(projects: readonly ScanProjectReport[]): readonly ScanCommitSlice[] {
  return projects
    .map((project) => ({
      name: project.repository.name,
      commits: project.report.commits.length,
    }))
    .sort((left, right) => right.commits - left.commits || left.name.localeCompare(right.name));
}

export function deriveScanChurnData(projects: readonly ScanProjectReport[]): readonly ScanChurnSlice[] {
  return projects
    .map((project) => {
      let additions = 0;
      let deletions = 0;
      for (const commit of project.report.commits) {
        for (const file of commit.files) {
          additions += file.additions;
          deletions += file.deletions;
        }
      }
      return { name: project.repository.name, additions, deletions, churn: additions + deletions };
    })
    .filter((item) => item.churn > 0)
    .sort((left, right) => right.churn - left.churn || left.name.localeCompare(right.name));
}

export function deriveScanAiPerProjectData(projects: readonly ScanProjectReport[]): readonly ScanAiProjectSlice[] {
  return projects
    .filter((project) => project.report.aiUsage !== undefined && project.report.aiUsage.records > 0)
    .map((project) => ({
      name: project.repository.name,
      messages: project.report.aiUsage!.records,
      inputTokens: project.report.aiUsage!.tokens.input,
      outputTokens: project.report.aiUsage!.tokens.output,
      cacheTokens: project.report.aiUsage!.tokens.cacheRead + project.report.aiUsage!.tokens.cacheWrite,
      tokens: project.report.aiUsage!.tokens.total,
    }))
    .sort((left, right) => right.messages - left.messages || left.name.localeCompare(right.name));
}

export function deriveScanAiModelsData(aiUsage: ReportAiUsageProjectSummary): readonly ScanAiModelSlice[] {
  return aiUsage.breakdowns.byModel
    .filter((item) => item.records > 0 || item.tokens.total > 0)
    .map((item) => ({
      name: item.key,
      messages: item.records,
      inputTokens: item.tokens.input,
      outputTokens: item.tokens.output,
      cacheTokens: item.tokens.cacheRead + item.tokens.cacheWrite,
      tokens: item.tokens.total,
    }))
    .sort((left, right) => right.messages - left.messages || left.name.localeCompare(right.name));
}

function heatClass(commits: number) {
  if (commits >= 8) {
    return "border-chart-4/40 bg-chart-4";
  }
  if (commits >= 4) {
    return "border-chart-3/40 bg-chart-3/80";
  }
  if (commits >= 1) {
    return "border-chart-2/30 bg-chart-2/45";
  }
  return "border-border bg-muted/45";
}
