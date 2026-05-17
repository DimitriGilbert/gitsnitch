import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@git-snitch/ui/components/button";
import { Input } from "@git-snitch/ui/components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@git-snitch/ui/components/table";
import { cn } from "@git-snitch/ui/lib/utils";
import { useMemo, useState } from "react";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import type { FileHotspot, CommitRecord, ContributorSummary } from "@git-snitch/core";

import { EmptyState } from "./empty-state";
import { downloadCsv } from "./export";
import type { CsvRow, DownloadResult } from "./export";

type CsvDownloader = (filename: string, rows: readonly CsvRow[], columns?: readonly string[]) => DownloadResult;

export type DataTableExport<TData> = {
  readonly filename: string;
  readonly mapRow: (row: TData) => CsvRow;
  readonly columns?: readonly string[];
  readonly downloader?: CsvDownloader;
};

export type DataTableEmptyState = {
  readonly title: string;
  readonly description: string;
};

export type DataTableProps<TData> = {
  readonly data: readonly TData[];
  readonly columns: readonly ColumnDef<TData>[];
  readonly emptyState: DataTableEmptyState;
  readonly search?: {
    readonly placeholder: string;
    readonly toText: (row: TData) => string;
  };
  readonly exportConfig?: DataTableExport<TData>;
  readonly initialPageSize?: number;
  readonly ariaLabel: string;
};

const defaultPageSize = 10;
const pageSizes = [5, 10, 25, 50] as const;

function getAriaSort(sortDirection: false | "asc" | "desc"): "ascending" | "descending" | "none" {
  if (sortDirection === "asc") {
    return "ascending";
  }
  if (sortDirection === "desc") {
    return "descending";
  }
  return "none";
}

export function DataTable<TData>({
  data,
  columns,
  emptyState,
  search,
  exportConfig,
  initialPageSize = defaultPageSize,
  ariaLabel,
}: DataTableProps<TData>) {
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: initialPageSize });
  const [exportStatus, setExportStatus] = useState<string | undefined>();

  const filteredData = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (search === undefined || normalizedQuery.length === 0) {
      return data;
    }
    return data.filter((row) => search.toText(row).toLocaleLowerCase().includes(normalizedQuery));
  }, [data, query, search]);

  const table = useReactTable({
    data: [...filteredData],
    columns: [...columns],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: { pagination, sorting },
  });

  const totalRows = filteredData.length;
  const firstVisibleRow = totalRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastVisibleRow = Math.min(totalRows, (pagination.pageIndex + 1) * pagination.pageSize);
  const canExport = exportConfig !== undefined && totalRows > 0;

  function handleSearchChange(value: string) {
    setQuery(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function handleExport() {
    if (exportConfig === undefined) {
      return;
    }
    const rows = table.getSortedRowModel().rows.map((row) => exportConfig.mapRow(row.original));
    const result = (exportConfig.downloader ?? downloadCsv)(exportConfig.filename, rows, exportConfig.columns);
    setExportStatus(result.status === "downloaded" ? "CSV export started." : result.reason);
  }

  if (data.length === 0) {
    return <EmptyState title={emptyState.title} description={emptyState.description} />;
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card/80 shadow-sm" aria-label={ariaLabel}>
      <div className="flex flex-col gap-3 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        {search ? (
          <label className="min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">Search table</span>
            <Input
              value={query}
              onChange={(event) => handleSearchChange(event.currentTarget.value)}
              placeholder={search.placeholder}
              className="h-9 rounded-lg border-border/70 bg-background/70 text-sm"
            />
          </label>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {totalRows === 0 ? "No matching rows" : `${firstVisibleRow}-${lastVisibleRow} of ${totalRows}`}
          </p>
          {exportConfig ? (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!canExport}>
              Export CSV
            </Button>
          ) : null}
        </div>
      </div>

      {totalRows === 0 ? (
        <div className="p-4">
          <EmptyState title="No matching rows" description="Adjust the search term to bring matching report rows back into view." />
        </div>
      ) : (
        <Table aria-label={ariaLabel}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className="bg-muted/30 px-3 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
                      aria-sort={canSort ? getAriaSort(sortDirection) : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md text-left font-semibold outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true">{sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "↕"}</span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-col gap-3 border-t border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page</span>
          <div className="flex gap-1" role="group" aria-label="Rows per page">
            {pageSizes.map((size) => (
              <Button
                key={size}
                type="button"
                variant={pagination.pageSize === size ? "secondary" : "ghost"}
                size="xs"
                onClick={() => table.setPageSize(size)}
                aria-pressed={pagination.pageSize === size}
                aria-label={`${size} rows per page`}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <span className="min-w-20 text-center text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
      {exportStatus ? <p className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground" aria-live="polite">{exportStatus}</p> : null}
    </section>
  );
}

export type CommitsTableProps = {
  readonly commits: readonly CommitRecord[];
  readonly exportFilename?: string;
  readonly downloader?: CsvDownloader;
};

export function CommitsTable({ commits, exportFilename = "commits.csv", downloader }: CommitsTableProps) {
  return (
    <DataTable
      ariaLabel="Commits table"
      data={commits}
      columns={commitColumns}
      search={{ placeholder: "Search commits, authors, files", toText: commitSearchText }}
      emptyState={{ title: "No commits to show", description: "This report did not include commits for the selected repository and branch scope." }}
      exportConfig={{ filename: exportFilename, mapRow: commitToCsvRow, columns: commitCsvColumns, downloader }}
    />
  );
}

export type ContributorsTableProps = {
  readonly contributors: readonly ContributorSummary[];
  readonly exportFilename?: string;
  readonly downloader?: CsvDownloader;
};

export function ContributorsTable({ contributors, exportFilename = "contributors.csv", downloader }: ContributorsTableProps) {
  return (
    <DataTable
      ariaLabel="Contributors table"
      data={contributors}
      columns={contributorColumns}
      search={{ placeholder: "Search contributors", toText: contributorSearchText }}
      emptyState={{ title: "No contributors to show", description: "This report has no contributor activity yet." }}
      exportConfig={{ filename: exportFilename, mapRow: contributorToCsvRow, columns: contributorCsvColumns, downloader }}
    />
  );
}

export type HotspotsTableProps = {
  readonly hotspots: readonly FileHotspot[];
  readonly exportFilename?: string;
  readonly downloader?: CsvDownloader;
};

export function HotspotsTable({ hotspots, exportFilename = "hotspots.csv", downloader }: HotspotsTableProps) {
  return (
    <DataTable
      ariaLabel="Hotspots table"
      data={hotspots}
      columns={hotspotColumns}
      search={{ placeholder: "Search files or contributors", toText: hotspotSearchText }}
      emptyState={{ title: "No hotspots to show", description: "This repository has no file churn data to rank yet." }}
      exportConfig={{ filename: exportFilename, mapRow: hotspotToCsvRow, columns: hotspotCsvColumns, downloader }}
    />
  );
}

function commitAdditions(commit: CommitRecord): number {
  return commit.files.reduce((sum, file) => sum + file.additions, 0);
}

function commitDeletions(commit: CommitRecord): number {
  return commit.files.reduce((sum, file) => sum + file.deletions, 0);
}

function formatDate(isoDate: string | undefined): string {
  if (isoDate === undefined) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(isoDate));
}

function numberCell(value: number): string {
  return value.toLocaleString("en");
}

function RiskBadge({ level }: { readonly level: FileHotspot["riskLevel"]["level"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        level === "high" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : undefined,
        level === "medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : undefined,
        level === "low" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : undefined,
      )}
    >
      {level}
    </span>
  );
}

const commitColumns: readonly ColumnDef<CommitRecord>[] = [
  {
    accessorKey: "shortHash",
    header: "Commit",
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.shortHash}</span>,
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => <span className="block max-w-xl truncate font-medium text-foreground">{row.original.message}</span>,
  },
  {
    accessorFn: (commit) => commit.author.name,
    id: "author",
    header: "Author",
  },
  {
    accessorKey: "classification",
    header: "Type",
    cell: ({ row }) => <span className="capitalize">{row.original.classification}</span>,
  },
  {
    accessorFn: (commit) => commitAdditions(commit),
    id: "additions",
    header: "Additions",
    cell: ({ row }) => numberCell(commitAdditions(row.original)),
  },
  {
    accessorFn: (commit) => commitDeletions(commit),
    id: "deletions",
    header: "Deletions",
    cell: ({ row }) => numberCell(commitDeletions(row.original)),
  },
  {
    accessorKey: "authoredAt",
    header: "Authored",
    cell: ({ row }) => formatDate(row.original.authoredAt),
  },
];

const contributorColumns: readonly ColumnDef<ContributorSummary>[] = [
  { accessorKey: "name", header: "Contributor", cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "commitCount", header: "Commits", cell: ({ row }) => numberCell(row.original.commitCount) },
  { accessorKey: "additions", header: "Additions", cell: ({ row }) => numberCell(row.original.additions) },
  { accessorKey: "deletions", header: "Deletions", cell: ({ row }) => numberCell(row.original.deletions) },
  { accessorKey: "filesChanged", header: "Files", cell: ({ row }) => numberCell(row.original.filesChanged) },
  { accessorKey: "lastCommitAt", header: "Last seen", cell: ({ row }) => formatDate(row.original.lastCommitAt) },
];

const hotspotColumns: readonly ColumnDef<FileHotspot>[] = [
  { accessorKey: "path", header: "File", cell: ({ row }) => <span className="font-mono text-xs text-foreground">{row.original.path}</span> },
  { accessorKey: "riskLevel.level", header: "Risk", cell: ({ row }) => <RiskBadge level={row.original.riskLevel.level} /> },
  { accessorKey: "hotspotScore", header: "Score", cell: ({ row }) => numberCell(row.original.hotspotScore) },
  { accessorKey: "changeCount", header: "Changes", cell: ({ row }) => numberCell(row.original.changeCount) },
  { accessorKey: "churn", header: "Churn", cell: ({ row }) => numberCell(row.original.churn) },
  { accessorKey: "contributorCount", header: "Contributors", cell: ({ row }) => numberCell(row.original.contributorCount) },
  { accessorKey: "lastChangedAt", header: "Last changed", cell: ({ row }) => formatDate(row.original.lastChangedAt) },
];

const commitCsvColumns = ["hash", "message", "author", "email", "classification", "additions", "deletions", "authoredAt", "files"] as const;
const contributorCsvColumns = ["name", "email", "commitCount", "additions", "deletions", "filesChanged", "firstCommitAt", "lastCommitAt"] as const;
const hotspotCsvColumns = ["path", "risk", "hotspotScore", "changeCount", "additions", "deletions", "churn", "contributors", "lastChangedAt"] as const;

function commitSearchText(commit: CommitRecord): string {
  return [
    commit.hash,
    commit.shortHash,
    commit.message,
    commit.author.name,
    commit.author.email,
    commit.classification,
    ...commit.refs,
    ...commit.files.map((file) => file.path),
  ].join(" ");
}

function contributorSearchText(contributor: ContributorSummary): string {
  return `${contributor.name} ${contributor.email}`;
}

function hotspotSearchText(hotspot: FileHotspot): string {
  return `${hotspot.path} ${hotspot.riskLevel.level} ${hotspot.contributors.join(" ")}`;
}

function commitToCsvRow(commit: CommitRecord): CsvRow {
  return {
    hash: commit.hash,
    message: commit.message,
    author: commit.author.name,
    email: commit.author.email,
    classification: commit.classification,
    additions: commitAdditions(commit),
    deletions: commitDeletions(commit),
    authoredAt: commit.authoredAt,
    files: commit.files.map((file) => file.path).join("; "),
  };
}

function contributorToCsvRow(contributor: ContributorSummary): CsvRow {
  return {
    name: contributor.name,
    email: contributor.email,
    commitCount: contributor.commitCount,
    additions: contributor.additions,
    deletions: contributor.deletions,
    filesChanged: contributor.filesChanged,
    firstCommitAt: contributor.firstCommitAt,
    lastCommitAt: contributor.lastCommitAt,
  };
}

function hotspotToCsvRow(hotspot: FileHotspot): CsvRow {
  return {
    path: hotspot.path,
    risk: hotspot.riskLevel.level,
    hotspotScore: hotspot.hotspotScore,
    changeCount: hotspot.changeCount,
    additions: hotspot.additions,
    deletions: hotspot.deletions,
    churn: hotspot.churn,
    contributors: hotspot.contributors.join("; "),
    lastChangedAt: hotspot.lastChangedAt,
  };
}
