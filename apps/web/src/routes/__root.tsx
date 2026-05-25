import { Toaster } from "@git-snitch/ui/components/sonner";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import appCss from "../index.css?url";

const SITE_URL = "https://git-snitch.dbuild.dev";
const SITE_NAME = "git-snitch";
const SITE_DESCRIPTION =
  "Generate standalone HTML reports for git repositories and recursive scans. CLI-powered, privacy-first, no backend required.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${SITE_NAME} - Standalone git activity reports` },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "theme-color", content: "#070807" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:url", content: SITE_URL },
      { property: "og:title", content: `${SITE_NAME} - Standalone git activity reports` },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${SITE_NAME} - Standalone git activity reports` },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: SITE_URL },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: SITE_NAME,
              description: SITE_DESCRIPTION,
              inLanguage: "en",
            },
            {
              "@type": "SoftwareApplication",
              "@id": `${SITE_URL}/#software`,
              name: "@git-snitch/cli",
              url: SITE_URL,
              description: SITE_DESCRIPTION,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Node.js",
              installUrl: "https://www.npmjs.com/package/@git-snitch/cli",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "Single-repo HTML reports",
                "Recursive scan reports",
                "Custom TSX templates",
                "CSV/JSON data export",
                "Standalone self-contained HTML output",
                "Privacy-first anonymization with --anon",
                "GitHub metadata enrichment via gh CLI",
              ],
              programmingLanguage: "TypeScript",
              codeRepository: "https://github.com/DimitriGilbert/gitsnitch",
            },
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              url: SITE_URL,
              name: "git-snitch",
              sameAs: ["https://github.com/DimitriGilbert/gitsnitch"],
            },
          ],
        }),
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
