import { Card, CardContent, CardHeader, CardTitle } from "@git-snitch/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@git-snitch/ui/components/table";
import type { ContributorSummary, RepoReportData, ReportData, ScanProjectReport, ScanReportData } from "@git-snitch/core";

import { EmptyState } from "./empty-state";
import { StatsGrid } from "./layout";
import { RepoOverview } from "./overview";

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
      label: project.repository.relativePath || project.repository.name,
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

function ScanIntro({ report }: { readonly report: ScanReportData }) {
  return (
    <section className="grid grid-flow-dense gap-5 rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Scan overview</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Evidence across {report.directory}: repository totals, comparable project rows, and contributors whose work spans more than one codebase.
        </p>
      </div>
      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Scan scope</p>
        <p className="mt-2 text-sm font-medium text-foreground">Max depth {report.options.scan.maxDepth}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Generated {report.generatedAt}</p>
      </div>
    </section>
  );
}

function ProjectComparison({ report }: { readonly report: ScanReportData }) {
  const entries = deriveScanProjectRouteEntries(report);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No repositories matched this scan"
        description="git-snitch did not find repositories within the configured directory, max depth, include patterns, and exclude patterns. Widen the scan scope or check that the target directory contains Git repositories."
      />
    );
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b border-border/60 bg-muted/25">
        <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Project comparison</CardTitle>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Comparable repository rows with direct drill-down links into the original repo report evidence.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Commits</TableHead>
              <TableHead>Contributors</TableHead>
              <TableHead>Churn</TableHead>
              <TableHead>Last commit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.slug}>
                <TableCell>
                  <a className="font-medium text-foreground underline-offset-4 hover:underline" href={entry.href}>
                    {entry.label}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.project.repository.path}</p>
                </TableCell>
                <TableCell>{formatNumber(entry.project.report.commits.length)}</TableCell>
                <TableCell>{formatNumber(entry.project.report.contributors.length)}</TableCell>
                <TableCell>{formatNumber(totalChurn(entry.project.report))}</TableCell>
                <TableCell>{entry.project.repository.lastCommitAt ?? "Not available"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CrossProjectContributors({ report }: { readonly report: ScanReportData }) {
  const contributors = deriveCrossProjectContributors(report);

  if (contributors.length === 0) {
    return (
      <EmptyState
        title="No shared contributors across projects"
        description="Each contributor identity currently appears in only one scanned repository. Shared contributor evidence will appear here once the same author email or name is present in more than one project."
      />
    );
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b border-border/60 bg-muted/25">
        <CardTitle className="text-lg font-semibold tracking-tight text-foreground">Cross-project contributors</CardTitle>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Author identities aggregated by email, then ranked by commits and project coverage.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contributor</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Commits</TableHead>
              <TableHead>Additions</TableHead>
              <TableHead>Deletions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributors.slice(0, 10).map((contributor) => (
              <TableRow key={contributor.key}>
                <TableCell>
                  <span className="font-medium text-foreground">{contributor.name}</span>
                  <p className="mt-1 text-xs text-muted-foreground">{contributor.email}</p>
                </TableCell>
                <TableCell>{formatNumber(contributor.projectCount)}</TableCell>
                <TableCell>{formatNumber(contributor.commitCount)}</TableCell>
                <TableCell>{formatNumber(contributor.additions)}</TableCell>
                <TableCell>{formatNumber(contributor.deletions)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ScanOverview({ report }: ScanRouteProps) {
  if (report.kind !== "scan") {
    return scanDataMismatch("Scan overview is unavailable for repository reports");
  }

  return (
    <div className="grid gap-6">
      <ScanIntro report={report} />
      <StatsGrid stats={buildScanStats(report)} />
      <ProjectComparison report={report} />
      <CrossProjectContributors report={report} />
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

  return (
    <div className="grid gap-6">
      <section className="grid grid-flow-dense gap-4 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="max-w-4xl">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{entry.project.repository.name}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Drill-down for {entry.project.repository.relativePath}. This view reuses the repository overview components against the scanned project's original report payload.
          </p>
        </div>
        <a className="text-sm font-medium text-foreground underline-offset-4 hover:underline" href="#/scan">
          Back to scan overview
        </a>
      </section>
      <RepoOverview report={entry.project.report} />
    </div>
  );
}
