# Agent UI Rules

Read this before changing marketing pages, renderer routes, charts, tables, templates, or shared UI components.

## Required Process

- Load the `gpt-taste` skill before UI design or substantial UI implementation.
- Use shadcn for missing primitives and install them into `packages/ui` only.
- Treat `packages/ui` as the source of truth for shared shadcn components, design tokens, globals, hooks, and UI utilities.
- Import shared primitives from `@git-snitch/ui/...`; do not duplicate shadcn components inside app folders.

## shadcn Commands

- Run shadcn commands from `/home/didi/workspace/Code/git-report/git-snitch`.
- Add shared primitives with `pnpm dlx shadcn@latest add <component> -c packages/ui`.
- If a generated command suggests app-local components, adapt it so shared primitives still land in `packages/ui`.

## Report Renderer UX

- Standalone report HTML must work without a dev server, backend, or external runtime network request.
- Use hash routing for file-protocol reports.
- Every route must handle the wrong report kind gracefully: repo views with scan data and scan views with repo data must not crash.
- Every chart, table, stats card, and route section that can receive empty or insufficient data needs an explicit empty state.
- Export controls should only appear where there is exportable data or should explain why export is unavailable.

## Design Quality

- Avoid generic AI layouts, filler cards, decorative noise, and copy that overpromises behavior not implemented by the CLI.
- Marketing copy must match actual v1 behavior: standalone HTML, repo and scan reports, custom templates, exports, no legacy aliases, no automatic browser opening.
- UI implementation must be responsive and keyboard-accessible where components are interactive.
- Prefer clear information hierarchy and dense, useful report views over decorative dashboards with weak data semantics.
