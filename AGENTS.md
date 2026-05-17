# AGENTS.md

git-snitch is a pnpm/Turborepo monorepo for a production-quality TypeScript CLI that generates standalone git activity reports, plus a TanStack Start marketing site.

## Workdir And Package Manager

- Run all commands and git operations from `/home/didi/workspace/Code/git-report/git-snitch`; this directory is its own git repository.
- This project uses `pnpm`. Do not use npm, yarn, bun, or parent-repo lockfiles for git-snitch work.
- Do not modify files outside this nested repository unless the user explicitly asks. Legacy files in the parent repo are read-only references only.
- Do not start long-running dev servers unless the user explicitly asks.

## Commands

- Install: `pnpm install`
- Build: `pnpm run build` or `pnpm turbo build`
- Typecheck: `pnpm run check-types` or `pnpm turbo check-types`
- Dev: `pnpm run dev`
- Web only: `pnpm run dev:web`
- Lint: `pnpm turbo lint` when lint scripts exist
- Test: `pnpm turbo test` when test scripts exist

## Monorepo Shape

- `apps/web` is the TanStack Start marketing site.
- `packages/ui` is the shared shadcn/ui package and the only source of truth for shadcn components.
- `packages/env` and `packages/config` provide shared environment/config tooling.
- Planned v1 packages include CLI, core git/report logic, and renderer packages; preserve Better-T-Stack/Turborepo conventions when adding them.

## Quality Bar

- Treat every change as production code: no AI slop, no placeholder implementations, no fake success states, no mock-only behavior, and no hardcoded demo paths unless they are explicit test fixtures.
- Do not leave `TODO`, `FIXME`, unused imports, unused variables, console-log hacks, void hacks, or broad type assertions.
- Do not use `any`, `as any`, or `: any`. Use precise types, `unknown`, Zod validation, or explicit narrowing.
- Use `import type` for type-only imports; keep external imports first, then a blank line, then local imports.
- Handle errors deliberately with clear, actionable user-facing messages. Do not catch and ignore failures.
- Report data crossing package/runtime boundaries must stay JSON-safe: ISO date strings, discriminated top-level `kind`, and no `Date`, functions, classes, Maps, Sets, or cycles.
- For detailed rules, read [`docs/agent/quality.md`](docs/agent/quality.md) before implementation work.

## Testing And TDD

- Use red-green-refactor: one failing behavior test, the smallest implementation, then cleanup.
- Test through public interfaces: CLI commands, core report APIs, renderer routes/components, or exported package contracts.
- Tests for git/report behavior must create deterministic generated git fixtures with fixed authors, dates, branches, commits, and messages. Do not depend on this repo's history or live network calls.
- Tests must assert meaningful behavior and failure paths. Do not add fake tests that only prove mocks were called.
- For detailed testing expectations, read [`docs/agent/testing.md`](docs/agent/testing.md) before adding or changing tests.

## UI Work

- Load the `gpt-taste` skill before UI design or substantial UI implementation.
- Install missing UI primitives through shadcn, targeting `packages/ui`; do not create a second shadcn source in an app.
- Every report route, chart, table, and panel that can receive empty or sparse data needs an explicit empty state.
- For detailed UI rules, read [`docs/agent/ui.md`](docs/agent/ui.md) before UI work.

## Verification

- Run the narrowest relevant checks after edits, then broader gates for substantial changes.
- Prefer `pnpm turbo check-types`, `pnpm turbo build`, and `pnpm turbo test` as packages gain scripts.
- If a command cannot run because scripts or environment support are missing, report that explicitly with the reason.
