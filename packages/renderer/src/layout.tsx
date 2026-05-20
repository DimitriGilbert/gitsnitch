import { buttonVariants } from "@git-snitch/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@git-snitch/ui/components/card";
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
  const titleContent = <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full flex-col gap-6 px-6 py-8 sm:px-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p> : null}
          {titleHref ? (
            <a href={titleHref} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {titleContent}
            </a>
          ) : (
            titleContent
          )}
          {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
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

export function StatsGrid({
  stats,
  emptyTitle = "No report statistics yet",
  emptyDescription = "This report does not include enough data for summary statistics.",
}: StatsGridProps) {
  if (stats.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <section aria-label="Report summary statistics" className="grid grid-flow-dense gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="min-h-32 shadow-none">
          <CardHeader>
            <CardTitle className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{stat.value}</p>
            {stat.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.description}</p> : null}
          </CardContent>
        </Card>
      ))}
    </section>
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
