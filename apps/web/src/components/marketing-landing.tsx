import { buttonVariants } from "@git-snitch/ui/components/button";
import { cn } from "@git-snitch/ui/lib/utils";
import { ArrowRight, Boxes, Code2, ExternalLink, FileArchive, MonitorDown, Package, ScanSearch, ShieldCheck, Star } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

const npmPackageUrl = "https://www.npmjs.com/package/git-snitch";
const githubUrl = "https://github.com/DimitriGilbert/gitsnitch";

const features = [
  {
    title: "Repo reports",
    description: "Turn a single repository into a navigable HTML report with overview, commits, contributors, charts, quality, and hotspots routes.",
    className: "md:col-span-3 md:row-span-2",
    icon: Code2,
  },
  {
    title: "Scan reports",
    description: "Run recursive scans from a directory, compare projects, and drill into each discovered repository without a hosted service.",
    className: "md:col-span-3 md:row-span-2",
    icon: ScanSearch,
  },
  {
    title: "Custom templates",
    description: "Pass `--template <path>` to provide route-level TSX overrides while missing routes fall back to the built-in renderer.",
    className: "md:col-span-2 md:row-span-2",
    icon: Boxes,
  },
  {
    title: "Exports",
    description: "Use report export controls for CSV/JSON data where the standalone renderer has exportable tables and datasets.",
    className: "md:col-span-2 md:row-span-2",
    icon: FileArchive,
  },
  {
    title: "Standalone HTML",
    description: "Each CLI run writes a self-contained report file designed for local sharing, archiving, and file-protocol viewing.",
    className: "md:col-span-2 md:row-span-2",
    icon: MonitorDown,
  },
  {
    title: "Privacy-first sharing",
    description: "Share reports without exposing repo names, author emails, or file paths. Pass --anon to sanitize everything in one flag.",
    className: "md:col-span-3 md:row-span-2",
    icon: ShieldCheck,
  },
  {
    title: "GitHub enriched",
    description: "Stars, forks, license, and topics automatically appear in your reports via the gh CLI. No token setup beyond what you already have.",
    className: "md:col-span-3 md:row-span-2",
    icon: Star,
  },
] as const;

const usageSteps = [
  {
    title: "Install the npm CLI",
    commands: ["pnpm add -D git-snitch", "npm install --save-dev git-snitch"],
  },
  {
    title: "Create a single-repo report",
    commands: ["pnpm exec git-snitch repo --output ./reports/repo.html", "pnpm exec git-snitch repo --open"],
  },
  {
    title: "Scan multiple repositories",
    commands: ["pnpm exec git-snitch scan ../workspace --output ./reports/scan.html", "pnpm exec git-snitch scan ../workspace --max-depth 3"],
  },
  {
    title: "Customize or protect output",
    commands: ["pnpm exec git-snitch repo --template ./report-template.tsx", "pnpm exec git-snitch repo --no-overwrite"],
  },
  {
    title: "Share safely",
    commands: ["pnpm exec git-snitch repo --anon --output report.html"],
  },
] as const;

const reportScreens = [
  {
    title: "Repo fixture",
    caption: "Illustrative fixture placeholder showing overview, contributors, quality signals, and hotspots in one file.",
    metrics: ["42 commits", "5 contributors", "87 health"],
  },
  {
    title: "Scan fixture",
    caption: "Illustrative fixture placeholder showing discovered repositories and project drill-down routes.",
    metrics: ["8 repos", "3 branches", "CSV export"],
  },
] as const;

const marqueeItems = ["repo", "scan", "--anon", "--template", "--json", "--open", "--no-overwrite", "--no-github", "worklog", "standalone HTML"] as const;

export function MarketingLanding() {
  const mainRef = useRef<HTMLElement>(null);

  useMarketingMotion(mainRef);

  return (
    <main ref={mainRef} className="w-full max-w-full overflow-x-hidden bg-[#070807] text-zinc-100">
      <MarketingNav />
      <Hero />
      <FeatureShowcase />
      <UsageGuide />
      <ReportGallery />
      <FinalAction />
    </main>
  );
}

function useMarketingMotion(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const motionRoot = containerRef.current;

    if (!motionRoot || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const rootElement: HTMLElement = motionRoot;

    let cleanup = () => {};

    async function loadMotion() {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);

      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        gsap.fromTo(
          "[data-reveal-word]",
          { opacity: 0.16, y: 18 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-reveal-copy]",
              start: "top 78%",
              end: "bottom 42%",
              scrub: true,
            },
          },
        );

        gsap.utils.toArray<HTMLElement>("[data-report-screen]").forEach((screen) => {
          gsap.fromTo(
            screen,
            { opacity: 0.2, scale: 0.86 },
            {
              opacity: 1,
              scale: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: screen,
                start: "top 82%",
                end: "bottom 30%",
                scrub: true,
              },
            },
          );
        });
      }, rootElement);

      cleanup = () => context.revert();
    }

    loadMotion().catch((error: unknown) => {
      throw new Error(`Marketing motion failed to initialize: ${String(error)}`);
    });

    return () => cleanup();
  }, [containerRef]);
}

function MarketingNav() {
  return (
    <nav aria-label="Primary" className="fixed left-1/2 top-5 z-50 w-[min(94vw,980px)] -translate-x-1/2">
      <div className="flex items-center justify-between rounded-full border border-white/15 bg-black/55 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:px-6">
        <a href="#top" className="font-semibold tracking-tight text-white">
          git-snitch
        </a>
        <div className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
          <a className="transition-colors hover:text-white" href="#features">
            Features
          </a>
          <a className="transition-colors hover:text-white" href="#usage">
            Usage
          </a>
          <a className="transition-colors hover:text-white" href="#screenshots">
            Screens
          </a>
        </div>
        <div className="flex items-center gap-2">
          <a href="/example.html" target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 rounded-full border-white/25 bg-white/10 px-4 text-white hover:bg-white/20 hover:text-white")}>
            Demo <ExternalLink className="size-3.5" />
          </a>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" className="rounded-full border border-white/15 p-2 text-zinc-300 transition-colors hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section id="top" className="relative isolate flex min-h-svh items-center justify-center overflow-hidden px-5 py-32 md:py-48">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_0%,rgba(154,255,191,0.22),transparent_32%),radial-gradient(circle_at_18%_70%,rgba(125,92,255,0.24),transparent_28%),linear-gradient(180deg,#050605,#10120f_58%,#070807)]" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[58vh] bg-cover bg-center opacity-35 mix-blend-luminosity grayscale contrast-125"
        style={{ backgroundImage: "url(https://picsum.photos/seed/git-report-terminal/1920/1080)" }}
      />
      <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
        <h1 className="max-w-6xl text-balance font-semibold leading-[0.88] tracking-[-0.08em] text-white [font-size:clamp(3rem,7vw,6.75rem)]">
          Standalone git reports for repos that need receipts.
        </h1>
        <p className="mt-9 max-w-3xl text-pretty text-lg leading-8 text-zinc-300 md:text-xl">
          git-snitch is a Node-based npm CLI that writes self-contained HTML reports for a repository or a recursive scan. No backend, no database, no browser launch unless you ask for <code className="rounded bg-white/10 px-2 py-1 text-white">--open</code>.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a href="#usage" className={cn(buttonVariants({ size: "lg" }), "rounded-full bg-white px-7 text-base text-black hover:bg-zinc-200")}>
            Install and run <ArrowRight className="size-4" />
          </a>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full border-white/25 bg-black/35 px-7 text-base text-white hover:bg-white/10 hover:text-white")}>
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

function FeatureShowcase() {
  return (
    <section id="features" className="px-5 py-32 md:py-48">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <h2 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">
            Reports shaped for local evidence, not cloud dashboards.
          </h2>
          <p data-reveal-copy className="text-xl leading-9 text-zinc-300">
            {"Generate archiveable HTML, inspect repository health, compare scans, export useful data, and swap route-level templates without changing the CLI contract."
              .split(" ")
              .map((word, index) => (
                <span key={`${word}-${index}`} data-reveal-word className="mr-1 inline-block">
                  {word}
                </span>
              ))}
          </p>
        </div>
        <div className="grid grid-flow-dense auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-6">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article key={feature.title} className={cn("group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-7 shadow-2xl shadow-black/25 transition-colors hover:bg-white/[0.08]", feature.className)}>
                <div className="flex h-full flex-col justify-between gap-10">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-white/10 bg-black/25 p-3 text-lime-200 transition-transform duration-700 ease-out group-hover:scale-105">
                      <Icon className="size-6" />
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-white/30 to-transparent" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-semibold tracking-[-0.04em] text-white">{feature.title}</h3>
                    <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">{feature.description}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function UsageGuide() {
  return (
    <section id="usage" className="px-5 py-32 md:py-48">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-lime-200/20 bg-lime-100 p-5 text-black md:p-10">
        <div className="mb-12 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Package className="mb-6 size-10" />
            <h2 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] md:text-7xl">Install it, write a file, choose when to open it.</h2>
          </div>
          <p className="max-w-md text-lg leading-8 text-black/70">
            The v1 CLI exposes only <code>git-snitch repo</code> and <code>git-snitch scan</code>. Output overwrites by default; add <code>--no-overwrite</code> to fail when the target exists.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          {usageSteps.map((step) => (
            <article key={step.title} className="rounded-[1.75rem] bg-black p-5 text-white shadow-xl shadow-black/20">
              <h3 className="text-xl font-semibold tracking-[-0.03em]">{step.title}</h3>
              <div className="mt-6 space-y-3">
                {step.commands.map((command) => (
                  <code key={command} className="block overflow-x-auto rounded-2xl border border-white/10 bg-white/10 p-3 text-sm leading-6 text-lime-100">
                    {command}
                  </code>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportGallery() {
  return (
    <section id="screenshots" className="py-32 md:py-48">
      <div className="mb-16 overflow-hidden border-y border-white/10 py-6">
        <div className="report-marquee flex w-max gap-10 text-3xl font-semibold tracking-[-0.04em] text-white/70 md:text-5xl">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 md:grid-cols-2">
        {reportScreens.map((screen) => (
          <article key={screen.title} data-report-screen className="group overflow-hidden rounded-[2.25rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
            <div className="min-h-[360px] bg-[linear-gradient(135deg,rgba(190,255,218,0.18),rgba(255,255,255,0.03)),radial-gradient(circle_at_top_right,rgba(125,92,255,0.24),transparent_32%)] p-6 transition-transform duration-700 ease-out group-hover:scale-105">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/55 p-5 backdrop-blur">
                <div className="mb-5 flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-300" />
                  <span className="size-3 rounded-full bg-amber-300" />
                  <span className="size-3 rounded-full bg-lime-300" />
                </div>
                <h3 className="text-3xl font-semibold tracking-[-0.04em] text-white">{screen.title}</h3>
                <p className="mt-3 text-zinc-300">{screen.caption}</p>
                <div className="mt-8 grid gap-3">
                  {screen.metrics.map((metric) => (
                    <div key={metric} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-lime-100">
                      {metric}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinalAction() {
  return (
    <footer className="px-5 pb-10 pt-32 md:pt-48">
      <div className="mx-auto max-w-7xl rounded-[2.75rem] bg-white p-8 text-black md:p-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <h2 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] md:text-7xl">
            Ship repo evidence as a file your team can keep.
          </h2>
          <div className="space-y-5">
            <p className="text-lg leading-8 text-black/70">
              Use the package and repository links below as placeholders until final release URLs are assigned.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={npmPackageUrl} className={cn(buttonVariants(), "rounded-full bg-black px-6 text-white hover:bg-zinc-800")}>npm package</a>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "rounded-full border-black/20 px-6 text-black hover:bg-black/5")}>GitHub</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
