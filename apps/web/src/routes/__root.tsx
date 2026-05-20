import { Toaster } from "@git-snitch/ui/components/sonner";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import appCss from "../index.css?url";

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "git-snitch - Standalone git activity reports",
      },
      {
        name: "description",
        content:
          "Generate standalone HTML reports for git repositories and repository scans with the @git-snitch/cli npm package.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script src="https://chemin.dbuild.dev/script.js" data-id="7040d34e-b41f-4f20-88d1-b86ac93266c4" data-utcoffset="2" data-server="https://chemin.dbuild.dev" />
      </head>
      <body>
        <div className="min-h-svh">
          <Outlet />
        </div>
        <Toaster richColors />
        <TanStackRouterDevtools position="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
