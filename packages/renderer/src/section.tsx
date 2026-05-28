import type { ReactNode } from "react";

import { cn } from "@git-snitch/ui/lib/utils";

const SECTION_RADIUS = "rounded-2xl";
const SECTION_PADDING = "p-5";
const SECTION_GAP = "gap-5";
const CARD_PADDING = "p-5";
const INNER_GAP = "gap-4";

type SectionProps = {
  readonly className?: string;
  readonly ariaLabel?: string;
  readonly children: ReactNode;
};

type SectionHeaderProps = {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
};

type SectionStatProps = {
  readonly label: string;
  readonly value: string | ReactNode;
  readonly description?: string;
};

type SectionGridProps = {
  readonly cols?: 2 | 3 | 4;
  readonly className?: string;
  readonly children: ReactNode;
};

export type DefinitionItem = {
  readonly label: string;
  readonly value: string | ReactNode;
};

type DefinitionListProps = {
  readonly items: readonly DefinitionItem[];
  readonly className?: string;
};

export function Section({ className, ariaLabel, children }: SectionProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        SECTION_RADIUS,
        "border border-border/70 bg-card/80 shadow-sm",
        SECTION_PADDING,
        "flex flex-col",
        INNER_GAP,
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeader({ title, description, children }: SectionHeaderProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2 pt-1">{children}</div> : null}
    </div>
  );
}

export function SectionStat({ label, value, description }: SectionStatProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">{value}</p>
      {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

const GRID_COLS_MAP = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function SectionGrid({ cols, className, children }: SectionGridProps) {
  return (
    <div
      className={cn(
        "grid",
        cols ? GRID_COLS_MAP[cols] : "grid-cols-1 sm:grid-cols-2",
        SECTION_GAP,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DefinitionList({ items, className }: DefinitionListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <p className={cn("text-sm leading-7 text-muted-foreground", className)}>
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? <span className="mx-3 opacity-40">·</span> : null}
          <span className="text-xs font-medium uppercase tracking-[0.12em] opacity-70">{item.label}</span>
          {" "}
          <span className="font-medium text-foreground">{item.value}</span>
        </span>
      ))}
    </p>
  );
}

export { SECTION_RADIUS, SECTION_PADDING, SECTION_GAP, CARD_PADDING, INNER_GAP };
