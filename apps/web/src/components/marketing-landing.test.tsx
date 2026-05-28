import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingLanding } from "./marketing-landing";

afterEach(() => cleanup());

describe("MarketingLanding", () => {
  it("positions git-snitch as a standalone git report generator", () => {
    render(<MarketingLanding />);

    expect(screen.getByRole("heading", { level: 1, name: /standalone git reports for repos that need receipts/i })).toBeTruthy();
    expect(screen.getByText(/self-contained HTML reports for a repository or a recursive scan/i)).toBeTruthy();
    expect(screen.getByText(/no backend, no database/i)).toBeTruthy();
  });

  it("renders the required v1 feature areas", () => {
    render(<MarketingLanding />);

    for (const heading of ["Repo reports", "Scan reports", "Custom templates", "Exports", "Standalone HTML"]) {
      expect(screen.getByRole("heading", { level: 3, name: heading })).toBeTruthy();
    }
  });

  it("documents accurate install and usage commands", () => {
    render(<MarketingLanding />);

    const usage = screen.getByRole("heading", { name: /install it, write a file, choose when to open it/i }).closest("section");

    if (usage === null) {
      throw new Error("Usage section was not rendered");
    }

    expect(within(usage).getByText("npx @git-snitch/cli repo")).toBeTruthy();
    expect(within(usage).getByText("npx @git-snitch/cli repo --open")).toBeTruthy();
    expect(within(usage).getByText("npx @git-snitch/cli repo --json > data.json")).toBeTruthy();
    expect(within(usage).getByText("npx @git-snitch/cli scan . --period 14d --open --ai-usage")).toBeTruthy();
    expect(within(usage).getByText('npx @git-snitch/cli scan ~/workspace --period 3m --exclude "legacy-*"')).toBeTruthy();
    expect(within(usage).getByText("npx @git-snitch/cli repo --anon -o report.html")).toBeTruthy();
  });

  it("does not advertise legacy aliases or automatic browser opening", () => {
    render(<MarketingLanding />);

    const pageText = document.body.textContent ?? "";

    expect(pageText).not.toMatch(/(?<!git-)\bsnitch\b/);
    expect(pageText).not.toMatch(/\bscattered\b/);
    expect(pageText).not.toMatch(/auto-open|automatically open|opens automatically/i);
    expect(pageText).toMatch(/no browser launch unless you ask for --open/i);
  });

  it("links to npm and GitHub", () => {
    render(<MarketingLanding />);

    expect(screen.getAllByRole("link", { name: /npm/i }).some((link) => link.getAttribute("href") === "https://www.npmjs.com/package/@git-snitch/cli")).toBe(true);
    expect(screen.getAllByRole("link", { name: /github/i }).some((link) => link.getAttribute("href") === "https://github.com/DimitriGilbert/gitsnitch")).toBe(true);
  });
});
