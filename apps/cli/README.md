# git-snitch

Standalone git activity reports. One HTML file, no server, no database, no hosting.

Turns a git repo into a self-contained HTML report with commits, contributors, charts, quality signals, and hotspot analysis. Run it locally, share the file, open it anywhere.

## Install

```bash
npx @git-snitch/cli repo        # run without installing
pnpm add -D @git-snitch/cli     # or install it
```

## Usage

Two commands. That's it.

### `git-snitch repo`

Report for a single repository.

```bash
git-snitch repo                           # current directory, write HTML, done
git-snitch repo ~/projects/myapp          # specific repo
git-snitch repo --open                    # generate and open in browser
git-snitch repo --json                    # dump raw JSON to stdout
git-snitch repo -o q4-report.html --open  # custom filename, open after
git-snitch repo --no-overwrite            # fail if output file already exists
```

### `git-snitch scan`

Recursively discovers git repos in a directory and builds a comparative report.

```bash
git-snitch scan . --period 14d --open --ai-usage   # last 2 weeks, open, include AI spend
git-snitch scan ~/workspace                         # scan everything under workspace
git-snitch scan . --period 3m --exclude "legacy-*"  # last quarter, skip legacy dirs
git-snitch scan . --max-depth 2 --no-github         # shallow scan, skip GitHub API
```

## Flags

Both commands share these flags:

| Flag | What it does |
|---|---|
| `-o, --output <path>` | Where to write the file |
| `--json` | Print JSON to stdout instead of writing HTML |
| `--open` | Open the report in your browser after writing |
| `--no-overwrite` | Abort if the output file already exists (default: overwrite) |
| `--since <iso>` | Only commits after this date (`2025-01-01T00:00:00Z`) |
| `--until <iso>` | Only commits before this date |
| `--verbose` | Print progress to stderr |

### `repo` only

| Flag | What it does |
|---|---|
| `--branch <ref>` | Include this branch (repeat for multiple) |
| `--all-branches` | Include all local and remote refs |
| `--ai-usage` | Include local AI assistant token/cost data |

### `scan` only

| Flag | What it does |
|---|---|
| `--period <duration>` | Time window: `7d`, `4w`, `3m`, `1y` |
| `--max-depth <n>` | How deep to recurse (default: 3) |
| `--exclude <glob>` | Skip directories matching this pattern (repeatable) |
| `--ai-usage` | Include local AI assistant token/cost data |

### Anonymization

Strip sensitive data before sharing reports.

```bash
git-snitch repo --anon                              # strip everything
git-snitch repo --hide-emails --hide-urls           # pick specific fields
git-snitch repo --anon --obfuscate-key mysecret     # deterministic hashing
```

| Flag | What it strips |
|---|---|
| `--anon` | All of the below at once |
| `--hide-names` | Author and contributor names → pseudonyms |
| `--hide-emails` | Email addresses → pseudonyms |
| `--hide-paths` | File paths → hashed |
| `--hide-urls` | Remote URLs → removed |
| `--hash-commits` | Commit hashes → anonymized |
| `--hide-messages` | Commit messages → classification label |
| `--obfuscate-key <str>` | Same key = same pseudonyms across runs |

### GitHub

Stars, forks, license, and topics are fetched automatically when a GitHub remote is detected (requires `gh` CLI). Pass `--no-github` to skip.

### Templates

Pass a TSX module to override report routes:

```bash
git-snitch repo --template ./my-template.tsx
```

Routes not covered by your template fall back to the built-in renderer.

## Config

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
