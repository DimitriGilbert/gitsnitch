import { Card, CardContent, CardHeader, CardTitle } from "@git-snitch/ui/components/card";
import { cn } from "@git-snitch/ui/lib/utils";

import type { FileHotspot, QualitySignal, RepoReportData, ReportData } from "@git-snitch/core";

import { EmptyState } from "./empty-state.js";
import { HotspotsTable } from "./tables.js";

type RepoRouteProps = {
  readonly report: ReportData;
};

type HealthRating = "Strong" | "Watch" | "Strained" | "Unclear";

const minimumConclusiveCommits = 3;
const minimumConclusiveContributors = 2;

type QualityMetric = {
  readonly label: string;
  readonly value: string;
  readonly description: string;
  readonly tone: "good" | "watch" | "risk" | "neutral";
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function repoDataMismatch(title: string) {
  return (
    <EmptyState
      title={title}
      description="This route expects a single-repository report. Scan reports use aggregate scan routes rather than repo-only quality views."
    />
  );
}

function repoFilename(report: RepoReportData, suffix: string) {
  const safeName = report.repository.name.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, "-").replaceAll(/^-|-$/g, "");
  return `${safeName.length > 0 ? safeName : "repo"}-${suffix}`;
}

function commitChurn(report: RepoReportData) {
  return report.commits.reduce(
    (sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.additions + file.deletions, 0),
    0,
  );
}

function averageCommitSize(report: RepoReportData) {
  if (report.commits.length === 0) {
    return 0;
  }

  return Math.round(commitChurn(report) / report.commits.length);
}

function busFactor(report: RepoReportData) {
  const sortedCommitCounts = report.contributors.map((contributor) => contributor.commitCount).filter((count) => count > 0).sort((left, right) => right - left);
  const totalCommits = sortedCommitCounts.reduce((sum, count) => sum + count, 0);

  if (totalCommits === 0) {
    return 0;
  }

  const threshold = totalCommits * 0.8;
  let covered = 0;
  let contributors = 0;

  for (const count of sortedCommitCounts) {
    covered += count;
    contributors += 1;
    if (covered >= threshold) {
      return contributors;
    }
  }

  return contributors;
}

function codeStability(report: RepoReportData) {
  const additions = report.commits.reduce((sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.additions, 0), 0);
  const deletions = report.commits.reduce((sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.deletions, 0), 0);

  if (report.commits.length === 0) {
    return 1;
  }

  if (deletions === 0) {
    return additions > 0 ? 2 : 1;
  }

  return Math.round((additions / deletions) * 100) / 100;
}

function severityPenalty(signal: QualitySignal) {
  if (signal.severity === "critical") {
    return 24;
  }
  if (signal.severity === "warning") {
    return 12;
  }
  return 6;
}

function hasConclusiveQualityEvidence(report: RepoReportData) {
  return report.commits.length >= minimumConclusiveCommits && report.contributors.length >= minimumConclusiveContributors;
}

export function deriveHealthScore(report: RepoReportData) {
  if (!hasConclusiveQualityEvidence(report)) {
    return { score: 0, rating: "Unclear" satisfies HealthRating };
  }

  const signalPenalty = report.analysis.qualitySignals.reduce((sum, signal) => sum + severityPenalty(signal), 0);
  const busFactorPenalty = report.commits.length > 0 && busFactor(report) <= 1 ? 16 : 0;
  const hotspotPenalty = report.analysis.hotspots.some((hotspot) => hotspot.riskLevel.level === "high") ? 10 : 0;
  const score = Math.max(0, Math.min(100, 100 - signalPenalty - busFactorPenalty - hotspotPenalty));

  if (score >= 80) {
    return { score, rating: "Strong" satisfies HealthRating };
  }
  if (score >= 55) {
    return { score, rating: "Watch" satisfies HealthRating };
  }
  return { score, rating: "Strained" satisfies HealthRating };
}

function qualityMetrics(report: RepoReportData): readonly QualityMetric[] {
  const factor = busFactor(report);
  const averageSize = averageCommitSize(report);
  const churn = commitChurn(report);
  const stability = codeStability(report);

  return [
    {
      label: "Bus factor",
      value: factor === 0 ? "No commits" : formatNumber(factor),
      description: "Contributors covering roughly 80% of observed commits.",
      tone: factor === 0 ? "neutral" : factor <= 1 ? "risk" : factor <= 2 ? "watch" : "good",
    },
    {
      label: "Avg commit size",
      value: `${formatNumber(averageSize)} lines`,
      description: "Mean changed lines per commit from file statistics.",
      tone: averageSize === 0 ? "neutral" : averageSize > 500 ? "risk" : averageSize > 200 ? "watch" : "good",
    },
    {
      label: "Churn",
      value: `${formatNumber(churn)} lines`,
      description: "Total additions and deletions in the selected repo scope.",
      tone: churn === 0 ? "neutral" : churn > 5_000 ? "risk" : churn > 1_000 ? "watch" : "good",
    },
    {
      label: "Stability ratio",
      value: stability.toLocaleString("en"),
      description: "Additions divided by deletions; sparse repos are marked explicitly.",
      tone: report.commits.length === 0 ? "neutral" : stability > 3 || stability < 0.5 ? "watch" : "good",
    },
  ];
}

function metricToneClass(tone: QualityMetric["tone"]) {
  if (tone === "risk") {
    return "border-red-500/30 bg-red-500/10";
  }
  if (tone === "watch") {
    return "border-amber-500/30 bg-amber-500/10";
  }
  if (tone === "good") {
    return "border-emerald-500/30 bg-emerald-500/10";
  }
  return "border-border/70 bg-card/80";
}

function HealthScorePanel({ report }: { readonly report: RepoReportData }) {
  const health = deriveHealthScore(report);
  const hasEvidence = health.rating !== "Unclear";
  const narrative = hasEvidence
    ? "The score combines observed warning signals, ownership concentration, and high-risk files. Tiny repositories are treated as inconclusive instead of being dressed up as healthy."
    : "There are not enough commits or contributors for a confident health label. Treat this repository as inconclusive until it has a larger evidence trail.";

  return (
    <section className="grid grid-flow-dense gap-5 rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center">
      <div className="rounded-2xl border border-border/70 bg-background/70 p-6">
        <p className="text-sm font-medium text-muted-foreground">Repository health score</p>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-6xl font-semibold tracking-[-0.08em] text-foreground">{hasEvidence ? health.score : "—"}</span>
          {hasEvidence ? <span className="pb-2 text-lg font-medium text-muted-foreground">/100</span> : null}
        </div>
        <p className="mt-3 text-base font-semibold text-foreground">{health.rating}</p>
      </div>
      <div className="max-w-4xl">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Quality signals without hiding the evidence trail.</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{narrative}</p>
      </div>
    </section>
  );
}

function QualityMetricCards({ report }: { readonly report: RepoReportData }) {
  return (
    <section aria-label="Quality metric cards" className="grid grid-flow-dense gap-4 md:grid-cols-2 xl:grid-cols-4">
      {qualityMetrics(report).map((metric) => (
        <Card key={metric.label} className={cn("overflow-hidden shadow-none transition-transform duration-500 ease-out hover:-translate-y-0.5", metricToneClass(metric.tone))}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function severityClass(severity: QualitySignal["severity"]) {
  if (severity === "critical") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  if (severity === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
}

function RecommendationsList({ signals }: { readonly signals: readonly QualitySignal[] }) {
  if (signals.length === 0) {
    return (
      <EmptyState
        title="No quality recommendations yet"
        description="git-snitch did not detect quality risks in the available report data. Empty and tiny repositories may simply not have enough evidence."
      />
    );
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 shadow-sm" aria-label="Quality recommendations">
      <div className="border-b border-border/70 p-5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Recommendations</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Prioritized actions generated from the report quality signals.</p>
      </div>
      <ol className="divide-y divide-border/70">
        {signals.map((signal) => (
          <li key={signal.id} className="grid gap-3 p-5 md:grid-cols-[auto_1fr] md:items-start">
            <span className={cn("inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold capitalize", severityClass(signal.severity))}>{signal.severity}</span>
            <div>
              <h3 className="font-semibold text-foreground">{signal.label}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{signal.summary}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function countRisk(hotspots: readonly FileHotspot[], level: FileHotspot["riskLevel"]["level"]) {
  return hotspots.filter((hotspot) => hotspot.riskLevel.level === level).length;
}

function highestRisk(hotspots: readonly FileHotspot[]) {
  const high = hotspots.find((hotspot) => hotspot.riskLevel.level === "high");
  if (high) {
    return high;
  }

  return hotspots.find((hotspot) => hotspot.riskLevel.level === "medium") ?? hotspots[0];
}

function RiskIndicators({ hotspots }: { readonly hotspots: readonly FileHotspot[] }) {
  const topRisk = highestRisk(hotspots);

  return (
    <section aria-label="Hotspot risk indicators" className="grid grid-flow-dense gap-4 md:grid-cols-3">
      <Card className="border-red-500/20 bg-red-500/10 shadow-none transition-transform duration-500 ease-out hover:-translate-y-0.5">
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">High risk files</CardTitle></CardHeader>
        <CardContent><p className="text-4xl font-semibold tracking-tight text-foreground">{formatNumber(countRisk(hotspots, "high"))}</p></CardContent>
      </Card>
      <Card className="border-amber-500/20 bg-amber-500/10 shadow-none transition-transform duration-500 ease-out hover:-translate-y-0.5">
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Medium risk files</CardTitle></CardHeader>
        <CardContent><p className="text-4xl font-semibold tracking-tight text-foreground">{formatNumber(countRisk(hotspots, "medium"))}</p></CardContent>
      </Card>
      <Card className="shadow-none transition-transform duration-500 ease-out hover:-translate-y-0.5">
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Top hotspot</CardTitle></CardHeader>
        <CardContent>
          <p className="truncate font-mono text-sm font-semibold text-foreground">{topRisk?.path ?? "No file risk"}</p>
          <p className="mt-2 text-xs text-muted-foreground">{topRisk ? `${formatNumber(topRisk.hotspotScore)} score from churn and contributors` : "No ranked file changes yet."}</p>
        </CardContent>
      </Card>
    </section>
  );
}

export function QualityRoute({ report }: RepoRouteProps) {
  if (report.kind !== "repo") {
    return repoDataMismatch("Quality is unavailable for scan reports");
  }

  const isTiny = !hasConclusiveQualityEvidence(report);

  return (
    <div className="grid gap-6">
      <HealthScorePanel report={report} />
      {isTiny ? (
        <EmptyState
          title="Quality evidence is sparse"
          description={`This repository has too little activity for a confident health narrative. At least ${minimumConclusiveCommits} commits and ${minimumConclusiveContributors} contributors are needed before git-snitch labels quality as strong, watch, or strained.`}
        />
      ) : null}
      <QualityMetricCards report={report} />
      <RecommendationsList signals={report.analysis.qualitySignals} />
    </div>
  );
}

export function HotspotsRoute({ report }: RepoRouteProps) {
  if (report.kind !== "repo") {
    return repoDataMismatch("Hotspots are unavailable for scan reports");
  }

  const hotspots = report.analysis.hotspots;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm">
        <div className="max-w-4xl">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Hotspots rank files where churn, frequency, and shared ownership intersect.</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Use this route to find files that deserve review before they become expensive coordination points. Low activity repositories show an explicit empty state instead of a fabricated risk map.
          </p>
        </div>
      </section>
      {hotspots.length > 0 ? <RiskIndicators hotspots={hotspots} /> : null}
      <HotspotsTable hotspots={hotspots} exportFilename={repoFilename(report, "hotspots.csv")} />
    </div>
  );
}
