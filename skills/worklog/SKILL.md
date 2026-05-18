---
name: worklog
description: Aggregates work reports across multiple repositories into a unified worklog. Use when the user asks for a cross-repo work summary, weekly/multi-repo report, or wants to combine repo-work-report outputs. Embeds not-ai-writer directives for natural output.
---

# Worklog

## Quick start

User says: "give me my work log across all repos for this sprint"

You scan their repos, pull commit history, and produce a single themed worklog.

## Required skills

You have to load the following skills: **not-ai-writer** (and optionally **repo-work-report** if analyzing individual repos)

## Multi-repo gathering workflow

### Phase 1 — Identify repositories

- Use explicit repo paths if the user provides them
- Otherwise scan common directories for `.git` folders (avoid `node_modules`, `.cache`, `venv`)
- Confirm the list with the user before proceeding if more than 5 repos found

### Phase 2 — Collect per-repo reports

- Run `git log --author=<user> --since=<start> --until=<end> --oneline --stat` per repo
- When repo-work-report output is available for a repo, prefer it over raw git log — it already contains classified, summarized data
- Classify each commit: feature / bug / infra / refactor / docs / chore
- Read diffs for any commit tagged significant (100+ lines changed, or touching critical paths)

### Phase 3 — Merge and deduplicate

- Build a unified timeline across all repos
- Identify cross-repo themes (e.g. "auth overhaul" touching API + frontend + shared lib)
- Group commits by theme and type, not by repo
- Deduplicate merge commits, automated dep bumps, and bot-generated entries

### Phase 4 — Structure the worklog

- **Title**: `# Worklog: <start date> – <end date>`
- **Executive summary**: 2–4 sentences covering the main accomplishments
- **Themed sections** (H2): Features, Bugs, Infrastructure, Refactoring, Docs
- **Per-repo breakdown**: subsections under each theme when repo-specific detail matters
- **Cross-repo initiatives**: call out work spanning multiple repos in a dedicated block
- **Stats table**: repo | commits | additions | deletions

## Writing directives

### Banned words and patterns

- Never use: delve, tapestry, symphony, comprehensive, holistic, intricate, leverage, orchestrate, foster, unlock, realm, underscore, meticulous
- No formal transitions: moreover, furthermore, consequently, therefore
- No "In conclusion" or "To summarize" closings

### Style rules

- Prioritize themes over repo-by-repo lists
- Write like explaining to a colleague over chat
- One cross-repo narrative beats five disconnected repo reports

**Good**: "The auth overhaul touched three repos: **api** got new middleware, **frontend** got a login rewrite, and **shared-lib** got token refresh logic."

**Bad**: "In **api**, auth middleware was added. Furthermore, in **frontend**..."

## Output format

```markdown
# Worklog: 2025-05-05 – 2025-05-16

## Executive Summary
[2–4 sentences]

## Features
- Description with **repo-name** `repo:abc1234`

## Bugs
- Description **repo-name** `repo:def5678`

## Cross-repo initiatives
- Theme description spanning **repo-a** `repo-a:abc` and **repo-b** `repo-b:xyz`

## Stats
| Repo | Commits | Additions | Deletions |
|------|---------|-----------|-----------|
```

Commit refs use format `repo:abc1234` (short hash, 7 chars). Repo names always **bold** inline.
