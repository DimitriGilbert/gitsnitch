import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";

import { readInjectedReportData } from "./data";

const rootRoute = createRootRoute({
  component: ReportShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ReportHome,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({
  history: createHashHistory(),
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function ReportShell() {
  return <Outlet />;
}

function ReportHome() {
  const state = readInjectedReportData();

  if (state.status === "missing") {
    return (
      <main className="min-h-screen bg-background p-8 text-foreground">
        <section className="mx-auto max-w-3xl rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-2xl font-semibold">git-snitch report template</h1>
          <p className="mt-3 text-muted-foreground">
            This standalone template is waiting for report data injection from the CLI build pipeline.
          </p>
        </section>
      </main>
    );
  }

  if (state.status === "invalid") {
    return (
      <main className="min-h-screen bg-background p-8 text-foreground">
        <section className="mx-auto max-w-3xl rounded-lg border border-destructive bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-2xl font-semibold">Report data could not be loaded</h1>
          <p className="mt-3 text-muted-foreground">{state.reason}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-8 text-foreground">
      <section className="mx-auto max-w-3xl rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Standalone git activity report</p>
        <h1 className="mt-3 text-3xl font-semibold">{state.report.kind === "repo" ? state.report.repository.name : state.report.directory}</h1>
        <p className="mt-3 text-muted-foreground">
          Renderer pipeline loaded a {state.report.kind} report generated at {state.report.generatedAt}.
        </p>
      </section>
    </main>
  );
}

export function App() {
  return <RouterProvider router={router} />;
}
