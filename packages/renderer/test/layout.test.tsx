// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "../src/empty-state";
import { AppShell, Navigation, StatsBar } from "../src/layout";
import { ThemeProvider } from "../src/theme";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("renderer layout foundations", () => {
  it("renders an accessible shell with header, navigation, theme control, and content", () => {
    render(
      <ThemeProvider defaultTheme="light" storageKey="layout-test-theme">
        <AppShell
          title="fixture-repo"
          eyebrow="Standalone git activity report"
          description="Generated for a deterministic fixture."
          navigationItems={[{ label: "Overview", href: "#/", current: true }]}
        >
          <p>Route content</p>
        </AppShell>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "fixture-repo", level: 1 })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Report sections" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Overview", current: "page" }).getAttribute("href")).toBe("#/");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeTruthy();
    expect(screen.getByText("Route content")).toBeTruthy();
  });

  it("renders disabled navigation items without links", () => {
    render(<Navigation items={[{ label: "Charts", href: "#/charts", disabled: true }]} />);

    expect(screen.getByText("Charts").getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("link", { name: "Charts" })).toBeNull();
  });

  it("renders an inline stats bar when summary data exists", () => {
    render(<StatsBar stats={[{ label: "Commits", value: 7, description: "Included commits" }]} />);

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("commits")).toBeTruthy();
  });

  it("renders an explicit empty state when summary data is absent", () => {
    render(<StatsBar stats={[]} emptyTitle="No summary" emptyDescription="The fixture is empty." />);

    expect(screen.getByRole("heading", { name: "No summary" })).toBeTruthy();
    expect(screen.getByText("The fixture is empty.")).toBeTruthy();
  });

  it("supports empty-state actions without hiding the explanation", () => {
    render(
      <EmptyState
        title="No exportable rows"
        description="Add commits before exporting a table."
        action={<a href="#/commits">Open commits</a>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No exportable rows" })).toBeTruthy();
    expect(screen.getByText("Add commits before exporting a table.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open commits" }).getAttribute("href")).toBe("#/commits");
  });
});
