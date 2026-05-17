// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import type { ContributorSummary } from "@git-snitch/core";

import { CommitsTable, ContributorsTable, DataTable } from "../src/tables";
import type { CsvRow, DownloadResult } from "../src/export";

afterEach(() => {
  cleanup();
});

type ScoreRow = {
  readonly name: string;
  readonly commits: number;
};

const scoreColumns: readonly ColumnDef<ScoreRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "commits", header: "Commits" },
];

const scoreRows: readonly ScoreRow[] = [
  { name: "Zach", commits: 2 },
  { name: "Ada", commits: 5 },
  { name: "Grace", commits: 3 },
];

describe("renderer table components", () => {
  it("renders explicit empty states for empty typed tables", () => {
    render(<CommitsTable commits={[]} />);

    expect(screen.getByText("No commits to show")).toBeTruthy();
    expect(screen.getByText("This report did not include commits for the selected repository and branch scope.")).toBeTruthy();
  });

  it("filters rows through the table search input", () => {
    render(<ContributorsTable contributors={[adaContributor, graceContributor]} />);

    fireEvent.change(screen.getByPlaceholderText("Search contributors"), { target: { value: "grace" } });

    expect(screen.getByText("Grace Hopper")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  it("shows a filtered empty state when search has no matching rows", () => {
    render(<ContributorsTable contributors={[adaContributor]} />);

    fireEvent.change(screen.getByPlaceholderText("Search contributors"), { target: { value: "missing" } });

    expect(screen.getAllByText("No matching rows").length).toBeGreaterThan(0);
    expect(screen.getByText("Adjust the search term to bring matching report rows back into view.")).toBeTruthy();
  });

  it("sorts data from accessible headers", () => {
    render(
      <DataTable
        ariaLabel="Score table"
        data={scoreRows}
        columns={scoreColumns}
        initialPageSize={5}
        emptyState={{ title: "No scores", description: "No scores are available." }}
      />,
    );

    const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
    expect(nameHeader.getAttribute("aria-sort")).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));

    expect(nameHeader.getAttribute("aria-sort")).toBe("ascending");

    const rows = screen.getAllByRole("row").slice(1);
    const firstRow = rows[0];
    expect(firstRow).toBeDefined();
    if (firstRow === undefined) {
      throw new Error("Expected a sorted table row.");
    }
    expect(within(firstRow).getByText("Ada")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));

    expect(nameHeader.getAttribute("aria-sort")).toBe("descending");
  });

  it("exposes the selected rows-per-page option to assistive technology", () => {
    render(
      <DataTable
        ariaLabel="Score table"
        data={scoreRows}
        columns={scoreColumns}
        initialPageSize={5}
        emptyState={{ title: "No scores", description: "No scores are available." }}
      />,
    );

    const fiveRows = screen.getByRole("button", { name: "5 rows per page" });
    const tenRows = screen.getByRole("button", { name: "10 rows per page" });

    expect(fiveRows.getAttribute("aria-pressed")).toBe("true");
    expect(tenRows.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(tenRows);

    expect(fiveRows.getAttribute("aria-pressed")).toBe("false");
    expect(tenRows.getAttribute("aria-pressed")).toBe("true");
  });

  it("paginates rows without hiding keyboard-accessible controls", () => {
    render(
      <DataTable
        ariaLabel="Score table"
        data={scoreRows}
        columns={scoreColumns}
        initialPageSize={2}
        emptyState={{ title: "No scores", description: "No scores are available." }}
      />,
    );

    expect(screen.getByText("Zach")).toBeTruthy();
    expect(screen.queryByText("Grace")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Grace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous" })).toBeTruthy();
  });

  it("exports the currently filtered rows through the CSV helper contract", () => {
    const calls: { readonly filename: string; readonly rows: readonly CsvRow[]; readonly columns?: readonly string[] }[] = [];
    const downloader = (filename: string, rows: readonly CsvRow[], columns?: readonly string[]): DownloadResult => {
      calls.push({ filename, rows, columns });
      return { status: "downloaded" };
    };

    render(<ContributorsTable contributors={[adaContributor, graceContributor]} exportFilename="team.csv" downloader={downloader} />);

    fireEvent.change(screen.getByPlaceholderText("Search contributors"), { target: { value: "ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    expect(firstCall).toBeDefined();
    if (firstCall === undefined) {
      throw new Error("Expected a CSV export call.");
    }
    expect(firstCall).toMatchObject({ filename: "team.csv" });
    expect(firstCall.rows).toEqual([
      {
        name: "Ada Lovelace",
        email: "ada@example.test",
        commitCount: 2,
        additions: 20,
        deletions: 4,
        filesChanged: 5,
        firstCommitAt: "2024-01-01T00:00:00.000Z",
        lastCommitAt: "2024-01-03T00:00:00.000Z",
      },
    ]);
    expect(screen.getByText("CSV export started.")).toBeTruthy();
  });
});

const adaContributor: ContributorSummary = {
  name: "Ada Lovelace",
  email: "ada@example.test",
  commitCount: 2,
  additions: 20,
  deletions: 4,
  filesChanged: 5,
  firstCommitAt: "2024-01-01T00:00:00.000Z",
  lastCommitAt: "2024-01-03T00:00:00.000Z",
};

const graceContributor: ContributorSummary = {
  name: "Grace Hopper",
  email: "grace@example.test",
  commitCount: 4,
  additions: 40,
  deletions: 6,
  filesChanged: 8,
  firstCommitAt: "2024-01-02T00:00:00.000Z",
  lastCommitAt: "2024-01-04T00:00:00.000Z",
};
