# Agent Quality Rules

Use these rules for implementation, refactoring, validation, and reviews in git-snitch.

## Production Standard

- Implement the smaller correct version instead of a shortcut that looks done.
- Avoid no-op UI, fake success states, placeholder data flow, and code that only works for hand-picked examples.
- Keep behavior deterministic. Avoid hidden global state, unowned timers, ambient process state, and mutation-heavy flows where simple data-in/data-out code works.
- Validate all external inputs at boundaries: CLI args, config files, environment variables, git command output, custom template modules, file paths, and injected report data.
- Make failure modes explicit. Return structured results where callers need partial failure details, and throw or exit with clear messages where users need to act.

## TypeScript And Imports

- Strict TypeScript is the baseline.
- Do not use `any`, `as any`, or `: any`.
- Prefer `unknown` plus validation/narrowing for untrusted input.
- Avoid unsafe non-null assertions. Only use `!` when the invariant is enforced immediately before use and obvious in nearby code.
- Avoid broad assertions that force values through the compiler. Model or validate the data instead.
- Use `import type` for type-only imports because `verbatimModuleSyntax` is expected.
- Keep external imports first, then a blank line, then local imports.
- Remove unused imports, variables, exports, and dead branches before handoff.

## Report And CLI Invariants

- Public report data is JSON-serializable: ISO strings for dates, no `Date` objects, functions, classes, Maps, Sets, or cycles.
- Top-level report data uses `kind: "repo" | "scan"`; renderer guards should check `kind` first.
- CLI commands are `git-snitch repo` and `git-snitch scan` only for v1.
- Do not add legacy aliases, hosted backends, remote provider APIs, dev-server report mode, or automatic browser opening.
- `--open` must be explicit. Output overwrites by default; `--no-overwrite` must fail if the target exists.
- Data injected into HTML must use a safe serializer that escapes script-breaking and HTML-significant sequences.

## Dependencies And Boundaries

- Check existing workspace dependencies and `pnpm-workspace.yaml` catalog entries before adding packages.
- Add dependencies only when they remove real complexity and fit the stack.
- Keep core git/report logic independent from renderer/UI concerns.
- Keep renderer components dependent on typed report contracts, not raw git output.
- Keep CLI parsing, config loading, report generation, and HTML rendering as separable public seams.
