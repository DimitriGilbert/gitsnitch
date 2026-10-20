import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { AiUsageBreakdownItem, AiUsageSummary, ReportAiUsageProjectSummary, ScanProjectReport } from "@git-snitch/core";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@git-snitch/ui/components/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@git-snitch/ui/components/tabs";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { EmptyState } from "./empty-state.js";
import { Section, SectionHeader } from "./section.js";
import { DataTable } from "./tables.js";
import { chartPalette, projectColor } from "./charts.js";

type AiUsagePanelProps = {
  readonly title?: string;
  readonly description?: string;
  readonly usage: AiUsageSummary | ReportAiUsageProjectSummary;
  readonly projects?: readonly AiUsageProjectSlice[];
};

export type AiUsageProjectSlice = {
  readonly name: string;
  readonly messages: number;
  readonly tokens: number;
  readonly daily: readonly { readonly day: string; readonly tokens: number }[];
};

const staticChartProps = { isAnimationActive: false } as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export function formatAiUsageCost(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatAiUsageTokens(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function hasBreakdowns(usage: AiUsageSummary | ReportAiUsageProjectSummary): usage is ReportAiUsageProjectSummary {
  return "breakdowns" in usage;
}

function usageHasTotals(usage: AiUsageSummary) {
  return usage.records > 0 || usage.tokens.total > 0 || usage.cost > 0 || (usage.unsubsidizedCost ?? 0) > 0;
}

function cachedShare(usage: AiUsageSummary) {
  const cached = usage.tokens.cacheRead + usage.tokens.cacheWrite;
  if (usage.tokens.input <= 0 || cached > usage.tokens.input) {
    return undefined;
  }
  return Math.round((cached / usage.tokens.input) * 100);
}

/** Estimated model-price cost first, recorded log cost as the small fallback line. */
export function AiCostCell({ cost, unsubsidizedCost, size = "sm" }: { readonly cost: number; readonly unsubsidizedCost?: number; readonly size?: "sm" | "table" }) {
  const recordedClass = size === "table" ? "text-xs text-muted-foreground" : "text-sm font-medium text-muted-foreground";
  if (unsubsidizedCost === undefined) {
    return (
      <span className="flex flex-col">
        <span>{formatAiUsageCost(cost)}</span>
        <span className={recordedClass}>recorded</span>
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span>{formatAiUsageCost(unsubsidizedCost)}</span>
      <span className={recordedClass}>recorded {formatAiUsageCost(cost)}</span>
    </span>
  );
}

function AiInputCell({ input, cacheRead, cacheWrite }: { readonly input: number; readonly cacheRead: number; readonly cacheWrite: number }) {
  const cached = cacheRead + cacheWrite;
  return (
    <span className="flex flex-col">
      <span>{formatAiUsageTokens(input)}</span>
      {cached > 0 ? <span className="text-xs text-muted-foreground">cached {formatAiUsageTokens(cached)}</span> : null}
    </span>
  );
}

function breakdownColumns(rows: readonly AiUsageBreakdownItem[]): ColumnDef<AiUsageBreakdownItem>[] {
  const columns: ColumnDef<AiUsageBreakdownItem>[] = [
    { accessorKey: "key", header: "Name", cell: ({ row }) => <span className="font-medium text-foreground">{row.original.key}</span> },
    { accessorKey: "tokens.total", header: "Total", cell: ({ row }) => formatAiUsageTokens(row.original.tokens.total) },
    { accessorKey: "records", header: "Messages", cell: ({ row }) => formatNumber(row.original.records) },
    { id: "input", header: "Input", cell: ({ row }) => <AiInputCell input={row.original.tokens.input} cacheRead={row.original.tokens.cacheRead} cacheWrite={row.original.tokens.cacheWrite} /> },
    { accessorKey: "tokens.output", header: "Output", cell: ({ row }) => formatAiUsageTokens(row.original.tokens.output) },
  ];
  if (rows.some((row) => row.tokens.reasoning > 0)) {
    columns.push({ accessorKey: "tokens.reasoning", header: "Reasoning", cell: ({ row }) => formatAiUsageTokens(row.original.tokens.reasoning) });
  }
  columns.push({ id: "cost", header: "Cost", cell: ({ row }) => <AiCostCell cost={row.original.cost} unsubsidizedCost={row.original.unsubsidizedCost} size="table" /> });
  return columns;
}

function BreakdownTable({ title, rows, emptyDescription }: { readonly title: string; readonly rows: readonly AiUsageBreakdownItem[]; readonly emptyDescription: string }) {
  const columns = useMemo(() => breakdownColumns(rows), [rows]);

  if (rows.length === 0) {
    return <EmptyState title={`${title} unavailable`} description={emptyDescription} />;
  }

  return (
    <DataTable
      ariaLabel={title}
      data={rows}
      columns={columns}
      bare
      search={{ placeholder: "Search", toText: (row) => row.key }}
      exportConfig={{
        filename: `${title.toLowerCase().replace(/\s+/g, "-")}.csv`,
        mapRow: (row) => ({
          name: row.key,
          messages: row.records,
          inputTokens: row.tokens.input,
          outputTokens: row.tokens.output,
          cacheTokens: row.tokens.cacheRead + row.tokens.cacheWrite,
          reasoningTokens: row.tokens.reasoning,
          totalTokens: row.tokens.total,
          recordedCost: row.cost,
          unsubsidizedCost: row.unsubsidizedCost ?? "",
        }),
      }}
      emptyState={{ title: `${title} unavailable`, description: emptyDescription }}
    />
  );
}

type RepartitionSlice = { readonly name: string; readonly tokens: number };

function RepartitionPie({ data, label }: { readonly data: readonly RepartitionSlice[]; readonly label: string }) {
  if (!data.some((slice) => slice.tokens > 0)) {
    return <EmptyState title={`No ${label.toLowerCase()} data to chart`} description="Token repartition appears once AI usage records are matched to this report." />;
  }

  return (
    <ChartContainer config={{ tokens: { label: "Tokens" } }} className="mx-auto aspect-square w-full max-w-[340px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie data={data} dataKey="tokens" nameKey="name" innerRadius={96} outerRadius={150} paddingAngle={2} {...staticChartProps}>
          {data.map((slice, index) => (
            <Cell key={slice.name} fill={chartPalette[index % chartPalette.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

function ProjectTokensArea({ projects }: { readonly projects: readonly AiUsageProjectSlice[] }) {
  const names = projects.map((project) => project.name);
  const config = names.reduce<Record<string, { label: string; color: string }>>((acc, name, index) => {
    acc[`project-${index}`] = { label: name, color: projectColor(index, names.length) };
    return acc;
  }, {});
  const data = useMemo(() => {
    const days = new Set<string>();
    for (const project of projects) {
      for (const entry of project.daily) {
        if (entry.tokens > 0) {
          days.add(entry.day);
        }
      }
    }
    return [...days].sort().map((day) => {
      const point: Record<string, number | string> = { day };
      for (const project of projects) {
        point[project.name] = project.daily.find((entry) => entry.day === day)?.tokens ?? 0;
      }
      return point;
    });
  }, [projects]);

  if (data.length === 0) {
    return <EmptyState title="No project AI usage to chart" description="Per-project token timelines appear once AI usage records are matched to scanned projects." />;
  }

  return (
    <ChartContainer config={config} className="h-72 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis width={40} tickLine={false} axisLine={false} tickFormatter={(value) => formatAiUsageTokens(Number(value))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {names.map((name, index) => {
          const key = `project-${index}`;
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={name}
              name={name}
              stackId="tokens"
              stroke={`var(--color-${key})`}
              fill={`var(--color-${key})`}
              fillOpacity={0.35}
              strokeWidth={1.5}
              {...staticChartProps}
            />
          );
        })}
      </AreaChart>
    </ChartContainer>
  );
}

/** Derives per-project AI token slices (with daily timelines) for the scan AI usage panel. */
export function deriveAiProjectSlices(projects: readonly ScanProjectReport[]): readonly AiUsageProjectSlice[] {
  return projects
    .filter((project) => project.report.aiUsage !== undefined && project.report.aiUsage.records > 0)
    .map((project) => ({
      name: project.repository.name,
      messages: project.report.aiUsage!.records,
      tokens: project.report.aiUsage!.tokens.total,
      daily: project.report.aiUsage!.breakdowns.byDay
        .map((row) => ({ day: row.key, tokens: row.tokens.total }))
        .sort((left, right) => left.day.localeCompare(right.day)),
    }))
    .sort((left, right) => right.tokens - left.tokens || left.name.localeCompare(right.name));
}

function StatBlock({ label, value, sub }: { readonly label: string; readonly value: string; readonly sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {sub !== undefined ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function AiUsageStats({ usage }: { readonly usage: AiUsageSummary }) {
  const cached = usage.tokens.cacheRead + usage.tokens.cacheWrite;
  const share = cachedShare(usage);

  return (
    <div className="grid grid-flow-dense gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
      <StatBlock label="Input tokens" value={formatAiUsageTokens(usage.tokens.input)} sub={cached > 0 ? `cached ${formatAiUsageTokens(cached)}${share === undefined ? "" : ` (${share}%)`}` : undefined} />
      <StatBlock label="Output tokens" value={formatAiUsageTokens(usage.tokens.output)} sub={usage.tokens.reasoning > 0 ? `reasoning ${formatAiUsageTokens(usage.tokens.reasoning)}` : undefined} />
      <StatBlock label="Total tokens" value={formatAiUsageTokens(usage.tokens.total)} />
      <StatBlock label={usage.unsubsidizedCost === undefined ? "Cost (recorded)" : "Cost (estimated)"} value={formatAiUsageCost(usage.unsubsidizedCost ?? usage.cost)} sub={usage.unsubsidizedCost === undefined ? undefined : `recorded ${formatAiUsageCost(usage.cost)}`} />
      <StatBlock label="Messages" value={formatNumber(usage.records)} />
    </div>
  );
}

function AiUsageBreakdownTabs({ usage, projects }: { readonly usage: ReportAiUsageProjectSummary; readonly projects?: readonly AiUsageProjectSlice[] }) {
  const hasProjectTab = projects !== undefined && projects.length > 0;
  const sortedByModel = useMemo(() => [...usage.breakdowns.byModel].sort((left, right) => right.tokens.total - left.tokens.total), [usage.breakdowns.byModel]);
  const sortedByClient = useMemo(() => [...usage.breakdowns.byClient].sort((left, right) => right.tokens.total - left.tokens.total), [usage.breakdowns.byClient]);

  return (
    <Tabs defaultValue="models">
      <TabsList>
        <TabsTrigger value="models">Models</TabsTrigger>
        <TabsTrigger value="harness">Harness</TabsTrigger>
        {hasProjectTab ? <TabsTrigger value="activity">Activity</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="models" className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-center">
        <RepartitionPie data={sortedByModel.map((row) => ({ name: row.key, tokens: row.tokens.total }))} label="model" />
        <BreakdownTable title="Model breakdown" rows={sortedByModel} emptyDescription="No model-level AI usage rows were available." />
      </TabsContent>
      <TabsContent value="harness" className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-center">
        <RepartitionPie data={sortedByClient.map((row) => ({ name: row.key, tokens: row.tokens.total }))} label="harness" />
        <BreakdownTable title="Client breakdown" rows={sortedByClient} emptyDescription="No client-level AI usage rows were available." />
      </TabsContent>
      {hasProjectTab ? (
        <TabsContent value="activity" className="grid gap-6">
          <ProjectTokensArea projects={projects} />
          <p className="text-sm text-muted-foreground">Per-project messages and cost are listed in the project comparison table.</p>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

export function AiUsagePanel({
  title = "AI usage",
  description = "Local assistant usage matched to this report. Workspace paths are not rendered in the HTML report.",
  usage,
  projects,
}: AiUsagePanelProps) {
  const hasTotals = usageHasTotals(usage);

  return (
    <Section ariaLabel={title}>
      <SectionHeader title={title} description={description} />
      <AiUsageStats usage={usage} />

      {!hasTotals ? (
        <EmptyState
          title="No AI usage matched this report"
          description="AI usage collection was enabled, but the matched local logs contain zero messages, tokens, and cost for this report scope."
        />
      ) : null}

      {hasBreakdowns(usage) ? <AiUsageBreakdownTabs usage={usage} projects={projects} /> : null}
    </Section>
  );
}
