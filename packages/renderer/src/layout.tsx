import { buttonVariants } from "@git-snitch/ui/components/button";
import { cn } from "@git-snitch/ui/lib/utils";
import type { ReactNode } from "react";

import { EmptyState } from "./empty-state.js";
import { ThemeToggle } from "./theme-toggle.js";

export type NavigationItem = {
  readonly label: string;
  readonly href: string;
  readonly current?: boolean;
  readonly disabled?: boolean;
};

export type StatItem = {
  readonly label: string;
  readonly value: string | number;
  readonly description?: string;
};

type HeaderProps = {
  readonly title: string;
  readonly titleHref?: string;
  readonly eyebrow?: string;
  readonly description?: string;
  readonly actions?: ReactNode;
};

type NavigationProps = {
  readonly items: readonly NavigationItem[];
  readonly label?: string;
};

type StatsGridProps = {
  readonly stats: readonly StatItem[];
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
};

type AppShellProps = {
  readonly title: string;
  readonly titleHref?: string;
  readonly eyebrow?: string;
  readonly description?: string;
  readonly navigationItems?: readonly NavigationItem[];
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
};

export function Header({ title, titleHref, eyebrow, description, actions }: HeaderProps) {
  const titleContent = <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full flex-col gap-3 px-6 py-4 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p> : null}
          {titleHref ? (
            <a href={titleHref} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {titleContent}
            </a>
          ) : (
            titleContent
          )}
          {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Navigation({ items, label = "Report sections" }: NavigationProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={label} className="border-b bg-background/80">
      <div className="mx-auto flex w-full gap-2 overflow-x-auto px-6 py-3 sm:px-10">
        {items.map((item) =>
          item.disabled ? (
            <span
              key={item.href}
              aria-disabled="true"
              className="inline-flex h-8 shrink-0 items-center border border-transparent px-3 text-xs font-medium text-muted-foreground/60"
            >
              {item.label}
            </span>
          ) : (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={buttonVariants({ variant: item.current ? "secondary" : "ghost", size: "sm", className: "shrink-0" })}
            >
              {item.label}
            </a>
          ),
        )}
      </div>
    </nav>
  );
}

export function StatsBar({
  stats,
  emptyTitle = "No report statistics yet",
  emptyDescription = "This report does not include enough data for summary statistics.",
}: StatsGridProps) {
  if (stats.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <p className="text-sm leading-7 text-muted-foreground" aria-label="Report summary statistics">
      {stats.map((stat, index) => (
        <span key={stat.label}>
          {index > 0 ? <span className="mx-2 opacity-40">·</span> : null}
          <strong className="font-medium text-foreground">{stat.value}</strong>{" "}
          {stat.label.toLowerCase()}
        </span>
      ))}
    </p>
  );
}

export function AppShell({
  title,
  titleHref,
  eyebrow,
  description,
  navigationItems = [],
  headerActions,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground transition-colors">
      <Header title={title} titleHref={titleHref} eyebrow={eyebrow} description={description} actions={headerActions} />
      <Navigation items={navigationItems} />
      <div className={cn("mx-auto flex w-full flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10")}>{children}</div>
    </main>
  );
}
