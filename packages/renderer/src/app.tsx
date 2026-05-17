import { createHashHistory, createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";

import { useReportData } from "./data";
import { EmptyState } from "./empty-state";
import { AppShell, StatsGrid } from "./layout";
import { ThemeProvider } from "./theme";

const rootRoute = createRootRoute({
  component: ReportShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ReportHome,
});

const routeTree = rootRoute.addChildren([indexRoute]);

function createRouterHistory() {
  if (typeof window === "undefined") {
    return createMemoryHistory({ initialEntries: ["/"] });
  }

  return createHashHistory();
}

export const router = createRouter({
  history: createRouterHistory(),
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function ReportShell() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}

function ReportHome() {
  const state = useReportData();

  if (state.status === "missing") {
    return (
      <AppShell title="git-snitch report template" description="A standalone renderer shell for CLI-generated git activity reports.">
        <EmptyState
          title="Report data has not been injected"
          description="Build the report through the CLI pipeline so the standalone HTML receives a JSON-safe report payload."
        />
      </AppShell>
    );
  }

  if (state.status === "invalid") {
    return (
      <AppShell title="Report data could not be loaded" description="The injected payload failed the renderer contract checks.">
        <EmptyState title="Invalid report data" description={state.reason} />
      </AppShell>
    );
  }

  const report = state.report;
  const title = report.kind === "repo" ? report.repository.name : report.directory;
  const stats =
    report.kind === "repo"
      ? [
          { label: "Commits", value: report.commits.length, description: "Included in this report window" },
          { label: "Contributors", value: report.contributors.length, description: "Identified by author identity" },
          { label: "Files at risk", value: report.analysis.hotspots.length, description: "Hotspot candidates available for later routes" },
          { label: "Languages", value: report.analysis.languages.length, description: "Detected from repository files" },
        ]
      : [
          { label: "Projects", value: report.projects.length, description: "Repositories included in the scan" },
          { label: "Commits", value: report.analysis.totalCommits, description: "Aggregate commits across projects" },
          { label: "Contributors", value: report.analysis.totalContributors, description: "Aggregate contributor identities" },
          { label: "Languages", value: report.analysis.languages.length, description: "Detected across scanned repositories" },
        ];

  return (
    <AppShell
      title={title}
      eyebrow="Standalone git activity report"
      description={`Renderer pipeline loaded a ${report.kind} report generated at ${report.generatedAt}.`}
      navigationItems={[{ label: "Overview", href: "#/", current: true }]}
    >
      <StatsGrid stats={stats} />
    </AppShell>
  );
}

export function App() {
  return <RouterProvider router={router} />;
}
