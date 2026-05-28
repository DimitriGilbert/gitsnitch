import {
  createHashHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";

import type { RepoReportData, ScanReportData, TemplateExportHelpers } from "@git-snitch/core";

import { templates as customTemplates } from "virtual:git-snitch-custom-templates";
import { useReportData } from "./data.js";
import { EmptyState } from "./empty-state.js";
import { downloadCsv, downloadJson } from "./export.js";
import { AppShell, StatsBar } from "./layout.js";
import { ChartsRoute } from "./charts-route.js";
import { RepoOverview } from "./overview.js";
import { HotspotsRoute, QualityRoute } from "./quality-hotspots-routes.js";
import { CommitsRoute, ContributorsRoute } from "./repo-routes.js";
import { normalizeGitRemote } from "./remote-url.js";
import { ScanOverview, ScanProjectRoute, deriveScanProjectRouteEntries } from "./scan-routes.js";
import { ThemeProvider } from "./theme.js";

const rootRoute = createRootRoute({
  component: ReportShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexRoute,
});

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/overview",
  component: OverviewRoute,
});

const commitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/commits",
  component: CommitsRouteContainer,
});

const contributorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contributors",
  component: ContributorsRouteContainer,
});

const chartsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/charts",
  component: ChartsRouteContainer,
});

const qualityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quality",
  component: QualityRouteContainer,
});

const hotspotsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hotspots",
  component: HotspotsRouteContainer,
});

const scanOverviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scan",
  component: ScanOverviewRouteContainer,
});

const scanProjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/scan/projects/$projectSlug",
  component: ScanProjectRouteContainer,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  overviewRoute,
  commitsRoute,
  contributorsRoute,
  chartsRoute,
  qualityRoute,
  hotspotsRoute,
  scanOverviewRoute,
  scanProjectRoute,
]);

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

function buildRepoDescription(report: RepoReportData): string {
  const repo = report.repository;
  const commits = report.commits.length;
  const contributors = report.contributors.length;
  const first = repo.firstCommitAt;
  const last = repo.lastCommitAt;

  if (first !== undefined && last !== undefined) {
    return `Report covering ${commits} commits across ${contributors} contributors, spanning ${formatDate(first)} to ${formatDate(last)}.`;
  }

  return `Report covering ${commits} commits across ${contributors} contributors.`;
}

function buildScanDescription(report: ScanReportData): string {
  return `Scan of ${report.directory} covering ${report.analysis.totalRepositories} repositories with ${report.analysis.totalCommits} total commits.`;
}

function ReportShell() {
  return (
    <ThemeProvider>
      <ReportRootLayout />
    </ThemeProvider>
  );
}

function IndexRoute() {
  const state = useReportData();
  return <Navigate to={state.status === "ready" && state.report.kind === "scan" ? "/scan" : "/overview"} replace />;
}

const repoNavigationItems = [
  { label: "Overview", href: "#/overview", path: "/overview", disabled: false },
  { label: "Commits", href: "#/commits", path: "/commits", disabled: false },
  { label: "Contributors", href: "#/contributors", path: "/contributors", disabled: false },
  { label: "Charts", href: "#/charts", path: "/charts", disabled: false },
  { label: "Quality", href: "#/quality", path: "/quality", disabled: false },
  { label: "Hotspots", href: "#/hotspots", path: "/hotspots", disabled: false },
] as const;

function ReportRootLayout() {
  const state = useReportData();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });

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
  const isAnonymized = report.anonymization?.applied === true;
  const title = report.kind === "repo" ? report.repository.name : "Scan report";
  const titleHref = report.kind === "repo" && !isAnonymized && report.repository.remoteUrl
    ? normalizeGitRemote(report.repository.remoteUrl)
    : undefined;
  const scanNavigationItems = report.kind === "scan"
    ? [
        { label: "Scan Overview", href: "#/scan", current: pathname === "/scan", disabled: false },
        ...deriveScanProjectRouteEntries(report).map((entry) => ({
          label: entry.label,
          href: entry.href,
          current: pathname === `/scan/projects/${entry.slug}`,
          disabled: false,
        })),
      ]
    : [{ label: "Scan Overview", href: "#/scan", current: pathname === "/scan", disabled: false }];
  const navigationItems = report.kind === "scan"
    ? scanNavigationItems
    : [
        ...repoNavigationItems.map((item) => ({
          label: item.label,
          href: item.href,
          current: item.path === pathname,
          disabled: item.disabled,
        })),
        ...scanNavigationItems,
      ];

  const headerActions = isAnonymized
    ? <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Anonymized</span>
    : undefined;

  const eyebrow = report.kind === "repo" && report.repository.currentBranch
    ? `Branch: ${report.repository.currentBranch}`
    : undefined;

  const description = report.kind === "repo"
    ? buildRepoDescription(report)
    : buildScanDescription(report);

  return (
    <AppShell
      title={title}
      titleHref={titleHref}
      eyebrow={eyebrow}
      description={description}
      navigationItems={navigationItems}
      headerActions={headerActions}
    >
      <Outlet />
    </AppShell>
  );
}

function OverviewRoute() {
  const state = useReportData();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "repo" && customTemplates.overview) {
    return customTemplates.overview({ report: state.report, helpers: createTemplateHelpers(state.report) });
  }

  return <RepoOverview report={state.report} />;
}

function CommitsRouteContainer() {
  const state = useReportData();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "repo" && customTemplates.commits) {
    return customTemplates.commits({ report: state.report, helpers: createTemplateHelpers(state.report) });
  }

  return <CommitsRoute report={state.report} />;
}

function ContributorsRouteContainer() {
  const state = useReportData();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "repo" && customTemplates.contributors) {
    return customTemplates.contributors({ report: state.report, helpers: createTemplateHelpers(state.report) });
  }

  return <ContributorsRoute report={state.report} />;
}

function ChartsRouteContainer() {
  const state = useReportData();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "repo" && customTemplates.charts) {
    return customTemplates.charts({ report: state.report, helpers: createTemplateHelpers(state.report) });
  }

  return <ChartsRoute report={state.report} />;
}

function QualityRouteContainer() {
  const state = useReportData();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "repo" && customTemplates.quality) {
    return customTemplates.quality({ report: state.report, helpers: createTemplateHelpers(state.report) });
  }

  return <QualityRoute report={state.report} />;
}

function HotspotsRouteContainer() {
  const state = useReportData();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "repo" && customTemplates.hotspots) {
    return customTemplates.hotspots({ report: state.report, helpers: createTemplateHelpers(state.report) });
  }

  return <HotspotsRoute report={state.report} />;
}

function ScanOverviewRouteContainer() {
  const state = useReportData();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "scan" && customTemplates.scanOverview) {
    return customTemplates.scanOverview({ report: state.report, helpers: createTemplateHelpers(state.report) });
  }

  return <ScanOverview report={state.report} />;
}

function ScanProjectRouteContainer() {
  const state = useReportData();
  const params = scanProjectRoute.useParams();

  if (state.status !== "ready") {
    return <StatsBar stats={[]} />;
  }

  if (state.report.kind === "scan" && customTemplates.scanProject) {
    return customTemplates.scanProject({ report: state.report, helpers: createTemplateHelpers(state.report), projectId: params.projectSlug });
  }

  return <ScanProjectRoute report={state.report} projectSlug={params.projectSlug} />;
}

function createTemplateHelpers(report: RepoReportData | ScanReportData): TemplateExportHelpers {
  return {
    downloadJson: (fileName) => downloadJson(fileName, report),
    downloadCsv: (fileName, rows) => downloadCsv(fileName, rows),
  };
}

export function App() {
  return <RouterProvider router={router} />;
}
