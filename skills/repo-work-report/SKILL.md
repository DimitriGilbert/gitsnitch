---
name: repo-work-report
description: >
  Generates a structured work report from a single git repository for a given time period
  using git commands and file/diff reading. Use when the user asks for a work summary,
  activity report, or "what did I do" for a repo in a date range. Embeds not-ai-writer
  directives for natural output.
---

# repo-work-report

## Quick start

Given a repo path and date range (e.g. `2025-01-01` to `2025-01-31`), run git log to collect commits, classify them by type, read diffs for the biggest changes, then write a markdown report grouped by commit classification with hashes, file paths, and a stats table.

## Required skills

You have to load the following skills: **not-ai-writer**

## Data gathering workflow

### Phase 1 — Collect raw commits

Run `git log` with `--since`, `--until`, `--numstat`, `--format` to get per-commit:
hash, short hash, author name, author date (ISO), subject line, full body, and per-file
addition/deletion counts. Include merge commits but flag them. Capture the repo's default
branch name via `git symbolic-ref refs/remotes/origin/HEAD` or `git rev-parse --abbrev-ref HEAD`.

### Phase 2 — Classify and group

Classify each commit using conventional-commit prefix matching and keyword heuristics.
The classification taxonomy mirrors `@git-snitch/core` CommitClassification:
`feature`, `fix`/`bugfix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`,
`build`, `revert`, `merge`, `release`, `other`.

Group commits by classification. Within each group, sort by date (newest first).
Identify significant commits: those with 10+ files changed, 200+ lines changed, or
non-trivial bodies.

### Phase 3 — Read diffs for context

For significant commits only, run `git show <hash>` to read the actual diff. Read changed
file contents where needed to understand what a change does. Infer module/feature area from
file paths (e.g. `packages/core/src/git/log.ts` → core/git module).

### Phase 4 — Structure the report

Build the markdown:

- **H1**: repo name + time range (e.g. `# my-app — Jan 1–31, 2025`)
- **Summary**: 3–5 sentence overview of what happened in plain language
- **H2 sections** per commit classification present, in this order:
  Features → Bugfixes → Refactor → Docs → Test → Chore → Other
- Each section lists commits as `abc1234: message` with file paths in backticks
- **Contributors**: list unique authors with commit counts
- **Stats table** at bottom: total commits, files changed, lines added/removed, per-type breakdown

## Writing directives

Banned words: delve, tapestry, symphony, comprehensive, holistic, intricate, leverage, orchestrate, foster, unlock, realm, underscore, meticulous.

No formal transitions: moreover, furthermore, consequently, therefore.

Write like explaining to a colleague who missed the sprint. Use specific commit messages and real file paths — never vague summaries like "various improvements." Mix short punchy sentences with longer ones. Contractions are fine. Never open with "It's important to note" or "It's worth mentioning." Just say the thing.

## Data shape awareness

The report structure aligns with `@git-snitch/core` types for future integration:
- CommitRecord shape: hash, shortHash, message, body, author, authoredAt, files (path, additions, deletions, status)
- CommitClassification: the union type listed in Phase 2
- These are reference shapes only — do not import or depend on package code

## Output format

```markdown
# repo-name — Start Date – End Date

Summary paragraph.

## Features

- `abc1234`: add user authentication endpoint (`src/auth/handler.ts`)
- `def5678`: implement rate limiting middleware (`src/middleware/rate-limit.ts`)

## Bugfixes

- `9ab0123`: fix null pointer in report generation (`src/report/builder.ts`)

## Stats

| Metric | Value |
|---|---|
| Total commits | 12 |
| Lines added | 847 |
| Lines removed | 231 |
| Files changed | 34 |
| Contributors | 3 |
```
