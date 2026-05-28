# git-snitch

Standalone git activity reports. One HTML file, no server, no database, no hosting.

git-snitch is a CLI that turns git repositories into self-contained HTML reports with commits, contributors, charts, quality signals, and hotspot analysis. Run it locally, share the file, open it anywhere.

## Install

```bash
npx @git-snitch/cli repo        # run without installing
pnpm add -D @git-snitch/cli     # or install it
```

## Quick Start

```bash
git-snitch repo                           # report for current repo
git-snitch scan . --period 14d --open     # scan directory, last 2 weeks, open result
git-snitch repo --anon -o report.html     # anonymized report
```

## CLI Reference

### `git-snitch repo`

Report for a single repository.

```bash
git-snitch repo [repoPath]
```

Default repoPath is `.`.

| Flag | What it does |
|---|---|
| `-o, --output <path>` | Where to write the file |
| `--json` | Print JSON to stdout instead of writing HTML |
| `--open` | Open the report in your browser |
| `--no-overwrite` | Abort if the output file already exists |
| `--since <iso>` | Only commits after this date |
| `--until <iso>` | Only commits before this date |
| `--branch <ref>` | Include this branch (repeatable) |
| `--all-branches` | Include all local and remote refs |
| `--template <path>` | TSX module for route-level overrides |
| `--ai-usage` | Include local AI assistant token/cost data |
| `--verbose` | Print progress to stderr |

### `git-snitch scan`

Recursively discovers git repos in a directory and builds a comparative report.

```bash
git-snitch scan [dir]
```

Default dir is `.`. Supports all `repo` flags plus:

| Flag | What it does |
|---|---|
| `--period <duration>` | Time window: `7d`, `4w`, `3m`, `1y` |
| `--max-depth <n>` | How deep to recurse (default: 3) |
| `--exclude <glob>` | Skip directories matching this pattern (repeatable) |

### Anonymization

```bash
git-snitch repo --anon                              # strip everything
git-snitch repo --hide-emails --hide-urls           # pick specific fields
git-snitch repo --anon --obfuscate-key mysecret     # deterministic pseudonyms
```

| Flag | What it strips |
|---|---|
| `--anon` | All of the below |
| `--hide-names` | Author names → pseudonyms |
| `--hide-emails` | Email addresses → pseudonyms |
| `--hide-paths` | File paths → hashed |
| `--hide-urls` | Remote URLs → removed |
| `--hash-commits` | Commit hashes → anonymized |
| `--hide-messages` | Commit messages → classification |
| `--obfuscate-key <str>` | Deterministic pseudonyms across runs |

### GitHub Enrichment

Stars, forks, license, and topics are fetched automatically when a GitHub remote is detected (requires `gh` CLI). Pass `--no-github` to skip.

### Templates

```bash
git-snitch repo --template ./my-template.tsx
```

Routes not covered by your template fall back to the built-in renderer.

### Config

Create `.git-snitch/config.json` in your repo or scan directory. CLI flags override config values.

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
    "since": "2025-01-01T00:00:00Z",
    "until": "2025-12-31T23:59:59Z"
  },
  "scan": {
    "maxDepth": 3,
    "excludePatterns": ["node_modules", ".git"]
  },
  "anon": {
    "hideEmails": true,
    "hideUrls": true,
    "obfuscateKey": "team-shared-secret"
  },
  "noGitHub": false
}
```

## Development

pnpm/Turborepo monorepo.

```bash
pnpm install           # Install all dependencies
pnpm run build         # Build all workspace packages
pnpm run check-types   # Type-check all packages
pnpm run test          # Run tests
pnpm run dev           # Start all dev tasks
pnpm run dev:web       # Start only the marketing site
```

Use `pnpm` from the repository root. Do not use npm, yarn, bun, or parent-repository lockfiles.

### Project Structure

```
git-snitch/
├── apps/
│   ├── cli/         # CLI entrypoint (git-snitch repo, scan)
│   └── web/         # Marketing site (React + TanStack Start)
├── packages/
│   ├── config/      # Shared TypeScript config
│   ├── core/        # Git data, analysis, report generation, anonymization
│   ├── env/         # Shared environment validation
│   ├── renderer/    # Standalone report renderer and template engine
│   └── ui/          # Shared shadcn/ui components
```
