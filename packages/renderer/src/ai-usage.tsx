import { Card, CardContent, CardHeader, CardTitle } from "@git-snitch/ui/components/card";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { AiUsageBreakdownItem, AiUsageSummary, ReportAiUsageProjectSummary } from "@git-snitch/core";

import { EmptyState } from "./empty-state.js";
import { DataTable } from "./tables.js";

type AiUsagePanelProps = {
  readonly title?: string;
  readonly description?: string;
  readonly usage: AiUsageSummary | ReportAiUsageProjectSummary;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export function formatAiUsageCost(value: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
}

export function formatAiUsageTokens(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function hasBreakdowns(usage: AiUsageSummary | ReportAiUsageProjectSummary): usage is ReportAiUsageProjectSummary {
  return "breakdowns" in usage;
}

function usageHasTotals(usage: AiUsageSummary) {
  return usage.records > 0 || usage.tokens.total > 0 || usage.cost > 0;
}

function SummaryMetric({ label, value, description }: { readonly label: string; readonly value: string; readonly description: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

const breakdownColumns: ColumnDef<AiUsageBreakdownItem>[] = [
  { accessorKey: "key", header: "Name", cell: ({ row }) => <span className="font-medium text-foreground">{row.original.key}</span> },
  { accessorKey: "records", header: "Messages", cell: ({ row }) => formatNumber(row.original.records) },
  { accessorKey: "tokens.total", header: "Tokens", cell: ({ row }) => formatAiUsageTokens(row.original.tokens.total) },
  { accessorKey: "cost", header: "Cost", cell: ({ row }) => formatAiUsageCost(row.original.cost) },
];

function BreakdownTable({ title, rows, emptyDescription }: { readonly title: string; readonly rows: readonly AiUsageBreakdownItem[]; readonly emptyDescription: string }) {
  const columns = useMemo(() => breakdownColumns, []);

  return (
    <DataTable
      ariaLabel={title}
      data={rows}
      columns={columns}
      search={{ placeholder: "Search", toText: (row) => row.key }}
      exportConfig={{
        filename: `${title.toLowerCase().replace(/\s+/g, "-")}.csv`,
        mapRow: (row) => ({ name: row.key, messages: row.records, tokens: row.tokens.total, cost: row.cost }),
      }}
      emptyState={{ title: `${title} unavailable`, description: emptyDescription }}
    />
  );
}

export function AiUsagePanel({
  title = "AI usage",
  description = "Local assistant usage matched to this report. Workspace paths are not rendered in the HTML report.",
  usage,
}: AiUsagePanelProps) {
  const hasTotals = usageHasTotals(usage);

  return (
    <Card className="overflow-hidden shadow-none transition-transform duration-500 ease-out hover:-translate-y-0.5" aria-label={title}>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold tracking-tight text-foreground">{title}</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-flow-dense gap-3 sm:grid-cols-3">
          <SummaryMetric label="Total tokens" value={formatNumber(usage.tokens.total)} description="Input, output, cache, and reasoning tokens." />
          <SummaryMetric label="Estimated cost" value={formatAiUsageCost(usage.cost)} description="USD estimate reported or derived from local logs." />
          <SummaryMetric label="Messages" value={formatNumber(usage.records)} description="Matched assistant usage records." />
        </div>

        {!hasTotals ? (
          <EmptyState
            title="No AI usage matched this report"
            description="AI usage collection was enabled, but the matched local logs contain zero messages, tokens, and estimated cost for this report scope."
          />
        ) : null}

        {hasBreakdowns(usage) ? (
          <div className="grid grid-flow-dense gap-4 xl:grid-cols-3">
            <BreakdownTable title="Client breakdown" rows={usage.breakdowns.byClient} emptyDescription="No client-level AI usage rows were available." />
            <BreakdownTable title="Model breakdown" rows={usage.breakdowns.byModel} emptyDescription="No model-level AI usage rows were available." />
            <BreakdownTable title="Recent days" rows={usage.breakdowns.byDay} emptyDescription="No dated AI usage rows were available." />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
