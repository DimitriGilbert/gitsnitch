---
name: changelog
description: "Generates a changelog from git repository data using commit classification and conventional commit parsing. Use when the user asks for a changelog, release notes, version history, or 'what changed' document. Embeds not-ai-writer directives for natural, scannable output."
---

# Changelog

## Quick start

- "generate a changelog for the last month"
- "create release notes for v2.0"
- "what changed between v1.0 and v2.0"

## Workflow

### Phase 1 — Gather commits

Run `git log` with full metadata: hash, author, date, subject, body.

- Support version tag ranges: `git log v1.0..v2.0`
- Support time ranges: `git log --since="2025-01-01" --until="2025-02-01"`
- Parse conventional commit prefixes: `feat:`, `feat!:`, `fix:`, `fix!:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:`, `revert:`
- Capture `BREAKING CHANGE` footers in commit bodies

### Phase 2 — Classify and filter

- Filter out merge commits (`Merge pull request`, `Merge branch`) unless they carry notable changes
- Filter out trivial chore/docs/test/ci commits unless user asks for full output
- Identify breaking changes: `feat!`, `fix!`, `BREAKING CHANGE` body footer
- Group commits by semantic type: feature, fix, breaking, refactor, other

### Phase 3 — Structure

Order sections:

1. Version header with release date
2. **Breaking Changes** first (if any)
3. **Features** (new capabilities)
4. **Bug Fixes** (corrective changes)
5. **Removed** (deleted functionality)
6. **Other** (refactors, performance, deps) only if notable

Each entry: one line, imperative verb, user-facing description, commit short-hash in parens. Surface user-visible changes prominently. Bury internal refactors.

### Phase 4 — Format

Follow [Keep a Changelog](https://keepachangelog.com) structure:

```markdown
## [version] - YYYY-MM-DD

### Added
- Add support for X ([`a1b2c3d`](commit-link))

### Changed
- Update Y to do Z ([`e4f5g6h`](commit-link))

### Fixed
- Fix crash when W ([`i7j8k9l`](commit-link))

### Removed
- Remove deprecated Q ([`m0n1o2p`](commit-link))
```

Use SemVer-based headers when a version is specified. Use `Unreleased` when no version tag anchors the range. Commit refs as short 7-char hashes in code ticks.

## Writing directives

Changelogs are technical documents — some formality is expected. Still:

- **Ban these words**: delve, tapestry, symphony, comprehensive, holistic, intricate, leverage, orchestrate, foster, unlock, realm, underscore, meticulous, seamless, exciting, thrilled
- **Start every entry with an imperative verb**: Add, Fix, Remove, Change, Update, Deprecate, Restore, Revert, Improve
- **Be specific**: "Fix null pointer in CSV export when repo has no commits" not "Fix a bug"
- **No filler between entries**: no "We are excited to announce", no "This release brings many improvements"
- **No preamble or closing paragraphs**: the changelog speaks through its entries alone
- **One concern per bullet**: split compound changes into separate entries

## Output format

- H2: `[version] - YYYY-MM-DD`
- H3: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`
- Bullets: imperative verb + specific description + short hash in parens
- Blank line between sections
- Multiple versions listed newest-first
