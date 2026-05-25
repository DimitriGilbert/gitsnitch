import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { ContributorSummary, RepoReportData, ReportData, ScanProjectReport, ScanReportData } from "@git-snitch/core";
import { cn } from "@git-snitch/ui/lib/utils";

import { AiUsagePanel, formatAiUsageCost, formatAiUsageTokens } from "./ai-usage.js";
import { ChartsRoute } from "./charts-route.js";
import {
  LanguageDistributionChart,
  ScanAiMessagesPieChart,
  ScanAiModelsPieChart,
  ScanAiTokensBarChart,
  ScanChurnPieChart,
  ScanCommitBarChart,
  deriveLanguageDistributionData,
  deriveScanAiModelsData,
  deriveScanAiPerProjectData,
  deriveScanChurnData,
  deriveScanCommitData,
} from "./charts.js";
import { EmptyState } from "./empty-state.js";
import { StatsGrid } from "./layout.js";
import { RepoOverview } from "./overview.js";
import { HotspotsRoute, QualityRoute } from "./quality-hotspots-routes.js";
import { normalizeGitRemote } from "./remote-url.js";
import { CommitsRoute, ContributorsRoute } from "./repo-routes.js";
import { Section, SectionHeader, SectionStat } from "./section.js";
import { DataTable } from "./tables.js";

type ScanRouteProps = {
  readonly report: ReportData;
};

type ScanProjectRouteProps = ScanRouteProps & {
  readonly projectSlug: string;
};

type ContributorAggregate = {
  readonly key: string;
  readonly name: string;
  readonly email: string;
  readonly commitCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly filesChanged: number;
  readonly projectCount: number;
};

type MutableContributorAggregate = Omit<ContributorAggregate, "projectCount"> & {
  readonly projectKeys: Set<string>;
};

type ProjectComparisonRow = {
  readonly slug: string;
  readonly href: string;
  readonly label: string;
  readonly remoteUrl: string | undefined;
  readonly commits: number;
  readonly contributors: number;
  readonly churn: number;
  readonly lastCommitAt: string | undefined;
  readonly aiMessages: number | undefined;
  readonly aiTotalTokens: number | undefined;
  readonly aiInputTokens: number | undefined;
  readonly aiOutputTokens: number | undefined;
  readonly aiCacheTokens: number | undefined;
  readonly aiCost: number | undefined;
};

export type ScanProjectRouteEntry = {
  readonly project: ScanProjectReport;
  readonly slug: string;
  readonly href: string;
  readonly label: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function totalChurn(report: RepoReportData) {
  return report.commits.reduce(
    (sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.additions + file.deletions, 0),
    0,
  );
}

function stableHash(value: string) {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36).slice(0, 6);
}

function slugBase(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug.length > 0 ? slug : "project";
}

function formatDate(isoDate: string | undefined): string {
  if (isoDate === undefined) {
    return "Not available";
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(isoDate));
}

export function deriveScanProjectSlug(project: ScanProjectReport) {
  const source = `${project.repository.id}|${project.repository.relativePath}|${project.repository.name}`;
  return `${slugBase(project.repository.id || project.repository.relativePath || project.repository.name)}-${stableHash(source)}`;
}

export function deriveScanProjectRouteEntries(report: ScanReportData): readonly ScanProjectRouteEntry[] {
  return report.projects.map((project) => {
    const slug = deriveScanProjectSlug(project);

    return {
      project,
      slug,
      href: `#/scan/projects/${slug}`,
      label: project.repository.name,
    };
  });
}

function scanDataMismatch(title: string) {
  return (
    <EmptyState
      title={title}
      description="This route expects a scan report. Open the repository overview, commits, contributors, charts, quality, or hotspots routes for single-repository data."
    />
  );
}

function buildScanStats(report: ScanReportData) {
  return [
    { label: "Repositories", value: formatNumber(report.analysis.totalRepositories), description: "Projects included in this scan report" },
    { label: "Commits", value: formatNumber(report.analysis.totalCommits), description: "Commits aggregated across scanned projects" },
    { label: "Contributors", value: formatNumber(report.analysis.totalContributors), description: "Contributor identities counted by the scan analysis" },
    { label: "Languages", value: formatNumber(report.analysis.languages.length), description: "Detected language groups across projects" },
  ];
}

function contributorKey(contributor: ContributorSummary) {
  const email = contributor.email.trim().toLowerCase();
  return email.length > 0 ? email : contributor.name.trim().toLowerCase();
}

export function deriveCrossProjectContributors(report: ScanReportData): readonly ContributorAggregate[] {
  const aggregates = new Map<string, MutableContributorAggregate>();

  for (const project of report.projects) {
    for (const contributor of project.report.contributors) {
      const key = contributorKey(contributor);
      const existing = aggregates.get(key);

      if (existing) {
        aggregates.set(key, {
          ...existing,
          commitCount: existing.commitCount + contributor.commitCount,
          additions: existing.additions + contributor.additions,
          deletions: existing.deletions + contributor.deletions,
          filesChanged: existing.filesChanged + contributor.filesChanged,
          projectKeys: new Set([...existing.projectKeys, project.repository.id]),
        });
      } else {
        aggregates.set(key, {
          key,
          name: contributor.name,
          email: contributor.email,
          commitCount: contributor.commitCount,
          additions: contributor.additions,
          deletions: contributor.deletions,
          filesChanged: contributor.filesChanged,
          projectKeys: new Set([project.repository.id]),
        });
      }
    }
  }

  return [...aggregates.values()]
    .map((aggregate) => ({
      key: aggregate.key,
      name: aggregate.name,
      email: aggregate.email,
      commitCount: aggregate.commitCount,
      additions: aggregate.additions,
      deletions: aggregate.deletions,
      filesChanged: aggregate.filesChanged,
      projectCount: aggregate.projectKeys.size,
    }))
    .filter((aggregate) => aggregate.projectCount > 1)
    .sort((left, right) => right.commitCount - left.commitCount || right.projectCount - left.projectCount || left.name.localeCompare(right.name));
}

const projectComparisonBaseColumns: ColumnDef<ProjectComparisonRow>[] = [
  {
    accessorKey: "label",
    header: "Project",
    cell: ({ row }) => (
      <div>
        <a className="font-medium text-foreground underline-offset-4 hover:underline" href={row.original.href}>
          {row.original.label}
        </a>
        {row.original.remoteUrl ? (
          <a
            className="mt-1 block text-xs text-muted-foreground hover:text-foreground"
            href={normalizeGitRemote(row.original.remoteUrl) ?? row.original.remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View remote
          </a>
        ) : null}
      </div>
    ),
  },
  { accessorKey: "commits", header: "Commits", cell: ({ row }) => formatNumber(row.original.commits) },
  { accessorKey: "contributors", header: "Contributors", cell: ({ row }) => formatNumber(row.original.contributors) },
  { accessorKey: "churn", header: "Churn", cell: ({ row }) => formatNumber(row.original.churn) },
  { accessorKey: "lastCommitAt", header: "Last commit", cell: ({ row }) => formatDate(row.original.lastCommitAt) },
];

const projectComparisonAiUsageColumns: ColumnDef<ProjectComparisonRow>[] = [
  { accessorKey: "aiTotalTokens", header: "AI total", cell: ({ row }) => row.original.aiTotalTokens === undefined ? "—" : formatAiUsageTokens(row.original.aiTotalTokens) },
  { accessorKey: "aiMessages", header: "AI messages", cell: ({ row }) => row.original.aiMessages === undefined ? "—" : formatNumber(row.original.aiMessages) },
  { accessorKey: "aiInputTokens", header: "AI input", cell: ({ row }) => row.original.aiInputTokens === undefined ? "—" : formatAiUsageTokens(row.original.aiInputTokens) },
  { accessorKey: "aiOutputTokens", header: "AI output", cell: ({ row }) => row.original.aiOutputTokens === undefined ? "—" : formatAiUsageTokens(row.original.aiOutputTokens) },
  { accessorKey: "aiCacheTokens", header: "AI cache", cell: ({ row }) => row.original.aiCacheTokens === undefined ? "—" : formatAiUsageTokens(row.original.aiCacheTokens) },
  { accessorKey: "aiCost", header: "AI cost", cell: ({ row }) => row.original.aiCost === undefined ? "—" : formatAiUsageCost(row.original.aiCost) },
];

const crossProjectContributorColumns: ColumnDef<ContributorAggregate>[] = [
  {
    accessorKey: "name",
    header: "Contributor",
    cell: ({ row }) => (
      <div>
        <span className="font-medium text-foreground">{row.original.name}</span>
        <p className="mt-1 text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  { accessorKey: "projectCount", header: "Projects", cell: ({ row }) => formatNumber(row.original.projectCount) },
  { accessorKey: "commitCount", header: "Commits", cell: ({ row }) => formatNumber(row.original.commitCount) },
  { accessorKey: "additions", header: "Additions", cell: ({ row }) => formatNumber(row.original.additions) },
  { accessorKey: "deletions", header: "Deletions", cell: ({ row }) => formatNumber(row.original.deletions) },
];

function ScanIntro({ report }: { readonly report: ScanReportData }) {
  return (
    <Section className="md:grid-cols-[minmax(0,1fr)_18rem] md:items-end md:grid">
      <SectionHeader
        title="Scan overview"
        description={`Evidence across ${report.projects.length} repositories: repository totals, comparable project rows, and contributors whose work spans more than one codebase.`}
      />
      <SectionStat
        label="Scan scope"
        value={`Max depth ${report.options.scan.maxDepth}`}
        description={`Generated ${report.generatedAt}`}
      />
    </Section>
  );
}

function ProjectComparison({ report }: { readonly report: ScanReportData }) {
  const entries = deriveScanProjectRouteEntries(report);
  const hasProjectAiUsage = report.projects.some((project) => project.report.aiUsage !== undefined);
  const columns = useMemo(
    () => hasProjectAiUsage ? [...projectComparisonBaseColumns, ...projectComparisonAiUsageColumns] : projectComparisonBaseColumns,
    [hasProjectAiUsage],
  );

  const rows: readonly ProjectComparisonRow[] = useMemo(
    () =>
      entries.map((entry) => {
        const usage = entry.project.report.aiUsage;

        return {
          slug: entry.slug,
          href: entry.href,
          label: entry.label,
          remoteUrl: entry.project.repository.remoteUrl,
          commits: entry.project.report.commits.length,
          contributors: entry.project.report.contributors.length,
          churn: totalChurn(entry.project.report),
          lastCommitAt: entry.project.repository.lastCommitAt,
          aiMessages: usage?.records,
          aiTotalTokens: usage?.tokens.total,
          aiInputTokens: usage?.tokens.input,
          aiOutputTokens: usage?.tokens.output,
          aiCacheTokens: usage !== undefined ? usage.tokens.cacheRead + usage.tokens.cacheWrite : undefined,
          aiCost: usage?.cost,
        };
      }),
    [entries],
  );

  return (
    <DataTable
      ariaLabel="Project comparison"
      data={rows}
      columns={columns}
      search={{ placeholder: "Search projects", toText: (row) => `${row.label}` }}
      emptyState={{
        title: "No repositories matched this scan",
        description: "git-snitch did not find repositories within the configured directory, max depth, include patterns, and exclude patterns. Widen the scan scope or check that the target directory contains Git repositories.",
      }}
    />
  );
}

function CrossProjectContributors({ report }: { readonly report: ScanReportData }) {
  const contributors = deriveCrossProjectContributors(report);

  return (
    <DataTable
      ariaLabel="Cross-project contributors"
      data={contributors}
      columns={crossProjectContributorColumns}
      search={{ placeholder: "Search contributors", toText: (row) => `${row.name} ${row.email}` }}
      exportConfig={{
        filename: "cross-project-contributors.csv",
        mapRow: (row) => ({ name: row.name, email: row.email, projects: row.projectCount, commits: row.commitCount, additions: row.additions, deletions: row.deletions }),
      }}
      emptyState={{
        title: "No shared contributors across projects",
        description: "Each contributor identity currently appears in only one scanned repository. Shared contributor evidence will appear here once the same author email or name is present in more than one project.",
      }}
    />
  );
}

function ScanCharts({ report }: { readonly report: ScanReportData }) {
  const commitData = deriveScanCommitData(report.projects);
  const churnData = deriveScanChurnData(report.projects);
  const languageData = deriveLanguageDistributionData(report);
  const aiPerProject = deriveScanAiPerProjectData(report.projects);
  const aiModels = report.analysis.aiUsage !== undefined ? deriveScanAiModelsData(report.analysis.aiUsage) : [];

  return (
    <section aria-label="Visual comparison">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">Visual comparison</h2>
      <div className="grid gap-5 lg:grid-cols-3">
        <ScanCommitBarChart data={commitData} />
        <ScanChurnPieChart data={churnData} />
        <LanguageDistributionChart data={languageData} />
        {aiPerProject.length > 0 ? <ScanAiMessagesPieChart data={aiPerProject} /> : null}
        {aiPerProject.length > 0 ? <ScanAiTokensBarChart data={aiPerProject} /> : null}
        {aiModels.length > 0 ? <ScanAiModelsPieChart data={aiModels} /> : null}
      </div>
    </section>
  );
}

export function ScanOverview({ report }: ScanRouteProps) {
  if (report.kind !== "scan") {
    return scanDataMismatch("Scan overview is unavailable for repository reports");
  }

  return (
    <div className="grid gap-5">
      <ScanIntro report={report} />
      <StatsGrid stats={buildScanStats(report)} />
      {report.analysis.aiUsage !== undefined ? (
        <AiUsagePanel
          title="Scan AI usage"
          description="Total matched local assistant usage across repositories in this scan. Workspace paths are not rendered in the HTML report."
          usage={report.analysis.aiUsage}
        />
      ) : null}
      <ProjectComparison report={report} />
      <ScanCharts report={report} />
      <CrossProjectContributors report={report} />
    </div>
  );
}

const scanProjectTabs = ["Overview", "Commits", "Contributors", "Charts", "Quality", "Hotspots"] as const;
type ScanProjectTab = (typeof scanProjectTabs)[number];

function ScanProjectTabs({ report }: { readonly report: RepoReportData }) {
  const [activeTab, setActiveTab] = useState<ScanProjectTab>("Overview");

  return (
    <div className="grid gap-5">
      <nav aria-label="Project sections" className="flex gap-1 rounded-2xl border border-border/70 bg-muted/25 p-1">
        {scanProjectTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>
      {activeTab === "Overview" ? <RepoOverview report={report} /> : null}
      {activeTab === "Commits" ? <CommitsRoute report={report} /> : null}
      {activeTab === "Contributors" ? <ContributorsRoute report={report} /> : null}
      {activeTab === "Charts" ? <ChartsRoute report={report} /> : null}
      {activeTab === "Quality" ? <QualityRoute report={report} /> : null}
      {activeTab === "Hotspots" ? <HotspotsRoute report={report} /> : null}
    </div>
  );
}

export function ScanProjectRoute({ report, projectSlug }: ScanProjectRouteProps) {
  if (report.kind !== "scan") {
    return scanDataMismatch("Scan project drill-down is unavailable for repository reports");
  }

  const entry = deriveScanProjectRouteEntries(report).find((candidate) => candidate.slug === projectSlug);

  if (!entry) {
    return (
      <EmptyState
        title="Scan project was not found"
        description="The project link does not match any repository in this scan report. Return to the scan overview and choose one of the generated project links."
      />
    );
  }

  const repoReport = entry.project.report;

  return (
    <div className="grid gap-5">
      <Section>
        <SectionHeader
          title={entry.project.repository.name}
          description={`Drill-down for ${entry.project.repository.name}. Overview, commits, contributors, charts, hotspots, and quality signals from the scanned project report.`}
        >
          <a className="text-sm font-medium text-foreground underline-offset-4 hover:underline" href="#/scan">
            Back to scan overview
          </a>
        </SectionHeader>
        {entry.project.repository.remoteUrl ? (
          <a
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            href={normalizeGitRemote(entry.project.repository.remoteUrl) ?? entry.project.repository.remoteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View remote
          </a>
        ) : null}
      </Section>
      <ScanProjectTabs report={repoReport} />
    </div>
  );
}
