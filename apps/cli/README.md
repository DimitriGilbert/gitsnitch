# git-snitch

Standalone git activity reports — single HTML files with no server, no database, no hosting.

git-snitch is a Node-based CLI that turns one or many git repositories into self-contained HTML reports with overview, commits, contributors, charts, quality signals, and hotspot analysis. Run it locally, share the file, open it anywhere.

## Features

- **Standalone HTML reports** — every run writes a single file you can archive, email, or open from the filesystem
- **Single-repo reports** — `git-snitch repo` generates a navigable report with overview, commits, contributors, charts, quality, and hotspots
- **Multi-repo scan reports** — `git-snitch scan` recursively discovers git repositories and produces a comparative report
- **Privacy and anonymization** — `--anon` one flag to strip repo names, author emails, file paths, remote URLs, commit hashes, and messages
- **GitHub enrichment** — stars, forks, license, and topics pulled automatically via the `gh` CLI
- **Optional AI usage summaries** — `--ai-usage` adds local assistant token, message, client, model, and cost totals when supported logs are available
- **AI-powered worklogs** — `git-snitch worklog` generates narrative work logs from report data using an AI harness
- **Custom templates** — pass `--template <path>` for route-level TSX overrides while missing routes fall back to the built-in renderer
- **JSON and CSV exports** — `--json` dumps raw report data; scan reports include exportable tables

## Installation

```bash
# run without installing
npx @git-snitch/cli repo

# pnpm (recommended)
pnpm add -D @git-snitch/cli

# npm
npm install --save-dev @git-snitch/cli
```

## Quick Start

```bash
# Generate a report for the current repository
npx @git-snitch/cli repo

# Scan a directory for all git repos
npx @git-snitch/cli scan ../workspace

# Generate and open immediately
npx @git-snitch/cli repo --open

# Share a report with sensitive data removed
npx @git-snitch/cli repo --anon --output report.html
```

## CLI Reference

### `git-snitch repo`

Generate a standalone report for one git repository.

```bash
git-snitch repo [repoPath]
```

**Argument:** `[repoPath]` — repository path (default: `.`)

**Output options:**

| Flag | Description |
|---|---|
| `-o, --output <path>` | Output file path |
| `--json` | Print report JSON instead of writing HTML |
| `--open` | Open the generated HTML report |
| `--no-overwrite` | Fail if the output file already exists |
| `--template <path>` | TSX module exporting route-level template overrides |
| `--ai-usage` | Include matched local AI assistant usage in the report |
| `--verbose` | Print progress to stderr while keeping JSON stdout clean |

**Branch selection:**

| Flag | Description |
|---|---|
| `--branch <ref>` | Branch or ref to include (repeatable) |
| `--all-branches` | Include local and remote refs |

**Date range:**

| Flag | Description |
|---|---|
| `--since <iso>` | Only include commits since an ISO 8601 UTC date |
| `--until <iso>` | Only include commits until an ISO 8601 UTC date |

**Anonymization:**

| Flag | Description |
|---|---|
| `--anon` | Enable full anonymization (shorthand for all `--hide-*` flags) |
| `--hide-names` | Replace author/contributor names with pseudonyms |
| `--hide-emails` | Replace emails with pseudonyms |
| `--hide-paths` | Hash file paths |
| `--hide-urls` | Remove remote URLs |
| `--hash-commits` | Replace commit hashes |
| `--hide-messages` | Replace commit messages with classification |
| `--obfuscate-key <string>` | Secret key for deterministic hashing |

**GitHub:**

| Flag | Description |
|---|---|
| `--no-github` | Skip GitHub API calls |

**Worklog:**

| Flag | Description |
|---|---|
| `--worklog-prompt <string>` | Override default AI prompt for worklog generation |
| `--worklog-harness <string>` | AI harness: `opencode`, `pi`, `codex` |
| `--worklog-model <string>` | Override default model for the AI harness |
| `--worklog-skill <string>` | AI skill template: `repo-log`, `work-log`, `changelog`, `devlog` |

### `git-snitch scan`

Generate a standalone report for multiple discovered git repositories.

```bash
git-snitch scan [dir]
```

**Argument:** `[dir]` — directory to scan (default: `.`)

Supports all flags from `repo` plus:

**Scan-specific:**

| Flag | Description |
|---|---|
| `--period <duration>` | Scan period such as `7d`, `4w`, `3m`, or `1y` |
| `--max-depth <number>` | Maximum recursive discovery depth |
| `--exclude <pattern>` | Additional directory glob to exclude (repeatable) |

**Worklog output:**

| Flag | Description |
|---|---|
| `--worklog-output <path>` | Output file path for the worklog document |

### `git-snitch worklog`

Generate an AI-powered work log from a git-snitch JSON export file.

```bash
git-snitch worklog <exportFile>
```

**Argument:** `<exportFile>` — path to a git-snitch JSON export file

| Flag | Description |
|---|---|
| `-o, --output <path>` | Output file path for the generated work log |
| `--prompt <text>` | Override the default AI prompt |
| `--harness <kind>` | AI harness to use: `opencode`, `pi`, `codex` |
| `--executor <kind>` | Alias for `--harness` |
| `-e <kind>` | Alias for `--harness` |
| `--model <name>` | Override the default AI model |
| `--skill <name>` | Skill template to use: `repo-log`, `work-log`, `changelog`, `devlog` |

**Shorthand aliases** for `repo` and `scan` worklog flags:

| Alias | Expands to |
|---|---|
| `--wl-prompt` | `--worklog-prompt` |
| `--wl-harness` | `--worklog-harness` |
| `--wl-model` | `--worklog-model` |
| `--wl-skill` | `--worklog-skill` |
| `--wl-output` | `--worklog-output` |

## Anonymization

Share reports without exposing sensitive repository data.

### `--anon` (full anonymization)

The `--anon` flag is a shorthand that enables all anonymization options at once:

```bash
git-snitch repo --anon
```

This replaces names, emails, file paths, remote URLs, commit hashes, and commit messages.

### Individual `--hide-*` flags

Enable only the anonymization you need:

```bash
git-snitch repo --hide-emails --hide-urls
```

| Flag | What it hides |
|---|---|
| `--hide-names` | Replaces author and contributor names with pseudonyms |
| `--hide-emails` | Replaces email addresses with pseudonyms |
| `--hide-paths` | Hashes file paths so directory structure is not exposed |
| `--hide-urls` | Removes remote URLs entirely |
| `--hash-commits` | Replaces commit hashes with anonymized values |
| `--hide-messages` | Replaces commit messages with a classification label |

### Deterministic hashing with `--obfuscate-key`

By default, anonymized values change on every run. Pass `--obfuscate-key` to get consistent pseudonyms across runs:

```bash
git-snitch repo --anon --obfuscate-key mysecret
```

The same key always produces the same pseudonyms, so you can compare anonymized reports over time without revealing the original data.

### Config file

Set anonymization defaults in `.git-snitch/config.json` so you don't repeat flags:

```json
{
  "anon": {
    "hideNames": true,
    "hideEmails": true,
    "hidePaths": true,
    "hideUrls": true,
    "hashCommits": true,
    "hideMessages": true,
    "obfuscateKey": "team-shared-secret"
  }
}
```

## GitHub Enrichment

git-snitch automatically enriches reports with GitHub metadata when it detects a GitHub remote.

### What gets fetched

- Star count
- Fork count
- License (SPDX identifier)
- Topics

This data appears in the report header and is included in JSON exports.

### Requirements

The `gh` CLI must be installed and authenticated. If `gh` is not available, git-snitch skips enrichment silently — the report still generates without it.

### Skip with `--no-github`

Pass `--no-github` to explicitly skip all GitHub API calls:

```bash
git-snitch repo --no-github
git-snitch scan ../workspace --no-github
```

## AI Usage

Pass `--ai-usage` to `repo` or `scan` to include local assistant usage in the HTML report and JSON export:

```bash
git-snitch repo --ai-usage
git-snitch scan ../workspace --ai-usage
```

Supported clients are OpenCode, Claude, Codex, Gemini, Amp, Kilo, and Pi. Reports show total tokens, estimated USD cost, message count, and available client/model/day breakdowns. Scan reports also include aggregate usage and per-project usage when records can be attributed to a scanned repository.

Project attribution depends on local log metadata. Gemini, Amp, and Kilo logs can be missing workspace paths; when only project hashes or session metadata are available, git-snitch leaves those rows unattributed instead of guessing a repository.

The AI usage parser is inspired by tokscale's local-session usage approach. Reference: [junhoyeo/tokscale](https://github.com/junhoyeo/tokscale), MIT licensed. git-snitch implements its own parser and does not vendor tokscale code.

### Config file

Set `noGitHub: true` in `.git-snitch/config.json` to disable GitHub enrichment by default:

```json
{
  "noGitHub": true
}
```

## Configuration

Create `.git-snitch/config.json` in your repository or scan directory to set defaults. CLI flags override config values.

```json
{
  "report": {
    "outputPath": "./reports/output.html",
    "overwrite": true,
    "format": "html",
    "templatePath": "./report-template.tsx"
  },
  "repo": {
    "branches": ["main", "develop"],
    "allBranches": false,
    "since": "2025-01-01T00:00:00Z",
    "until": "2025-12-31T23:59:59Z"
  },
  "scan": {
    "maxDepth": 3,
    "excludePatterns": ["node_modules", ".git"]
  },
  "anon": {
    "hideNames": false,
    "hideEmails": true,
    "hidePaths": false,
    "hideUrls": true,
    "hashCommits": false,
    "hideMessages": false,
    "obfuscateKey": "optional-secret"
  },
  "noGitHub": false,
  "worklog": {
    "prompt": "Summarize the team's activity for this period.",
    "harness": "opencode",
    "model": "gpt-4",
    "skill": "work-log",
    "outputPath": "./reports/worklog.html"
  }
}
```

## Development

This project is a pnpm/Turborepo monorepo.

```bash
pnpm install           # Install all dependencies
pnpm run build         # Build all workspace packages
pnpm run check-types   # Type-check all packages
pnpm run test          # Run tests
pnpm run dev           # Start all dev tasks
pnpm run dev:web       # Start only the marketing site
```

### Package Manager

Use `pnpm` from the repository root. Do not use npm, yarn, bun, or parent-repository lockfiles.

### UI Customization

React web apps share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

Add shared components from the project root:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import them:

```tsx
import { Button } from "@git-snitch/ui/components/button";
```

## Project Structure

```
git-snitch/
├── apps/
│   ├── cli/         # CLI command entrypoint (git-snitch repo, scan, worklog)
│   └── web/         # Marketing site (React + TanStack Start)
├── packages/
│   ├── config/      # Shared TypeScript configuration
│   ├── core/        # Git data, config, analysis, report generation, anonymization
│   ├── env/         # Shared environment validation helpers
│   ├── renderer/    # Standalone report renderer and template engine
│   └── ui/          # Shared shadcn/ui components and styles
```
