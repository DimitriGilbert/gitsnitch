# git-snitch: Skills + Worklog Command + Worklog Options (Combined Plan)

## Overview

This plan combines three related features into a single orchestrated workflow:

1. **4 AI Skills** (repo-work-report, worklog, changelog, devlog) — instruction-only `skills/` files shipped with the repo
2. **`worklog` CLI command** — standalone command that takes a JSON export file and produces an AI-generated worklog via a harness subprocess
3. **`--worklog-*` / `--wl-*` options** — worklog output mode added to existing `repo` and `scan` commands, with config integration and HTML rendering

The plan is structured so that shared types and harness infrastructure are built first in `@git-snitch/core`, then consumed by both the standalone command and the options-based worklog mode.

## Prerequisites

- pnpm installed, monorepo bootstrapped (`pnpm install` already run)
- Working build: `pnpm turbo check-types && pnpm turbo build` pass on `main`
- No uncommitted changes on the working branch

## Project Root

All paths are relative to `/home/didi/workspace/Code/git-report/git-snitch/`.

---

## Phase 1: Skills (4 AI Skills)

**Type**: Parallel

**Context**: These are instruction-only markdown files under `skills/`. They contain no code, no TypeScript, no imports. They are SKILL.md files (and one REFERENCES.md) that tell an AI agent how to generate specific document types from git report data.

### Sub-phase 1.1: repo-work-report Skill

**Requirements**:
- Create directory `git-snitch/skills/repo-work-report/`
- Create `SKILL.md` (single file, must be under 100 lines)
- Frontmatter `description` field (max 1024 chars, third person, includes trigger words):
  ```
  Generates a structured work report from a single git repository for a given time period using git commands and file/diff reading. Use when the user asks for a work summary, activity report, or "what did I do" for a repo in a date range. Embeds not-ai-writer directives for natural output.
  ```
- Content sections:
  - **Quick Start**: Single-paragraph example usage (e.g., user asks "what did I work on last week in this repo?")
  - **Data Gathering Workflow** (4 phases):
    - Phase 1: Collect raw commits — `git log --since=<start> --until=<end> --numstat --pretty=format:...` — include hash, short hash, author, date, subject, body, file stats. Respect `--all-branches` vs current branch only.
    - Phase 2: Classify and group — group commits by classification (feature, bugfix, refactor, docs, test, chore, etc.), order by date within each group, identify significant commits (large diffs, cross-cutting changes).
    - Phase 3: Read diffs for context — `git show <hash>` for significant commits, read changed files, use file paths to infer module/feature areas.
    - Phase 4: Structure the report — repository name and time range, summary section (3-5 sentences, not-ai-writer compliant), sections by commit type (Features shipped, Bugs fixed, Refactoring, Documentation, Tests, Other/maintenance), bullet list with commit hashes, contributors active, key files/modules touched, stats table (total commits, additions, deletions, files changed).
  - **Writing Directives (not-ai-writer)**:
    - Banned vocabulary: delve, tapestry, symphony, comprehensive, holistic, intricate, leverage, orchestrate, foster, unlock, realm, underscore, meticulous
    - No formal transitions (moreover, furthermore, consequently, therefore)
    - Use specific commit messages and file paths, not vague summaries
    - Short punchy sentences mixed with longer explanatory ones
    - Contractions allowed and encouraged
    - No "It's important to note" or "It's worth mentioning"
    - Write like explaining to a colleague, not writing a press release
  - **Output Format**: Markdown with H1 (repo name + time range), H2 sections by type, commit references as `abc1234: message`, file paths in backticks, stats in compact table at bottom
- Skills reference `@git-snitch/core` types (CommitRecord, CommitClassification, ContributorSummary, etc.) for understanding data shapes but do NOT import or execute code

**Outputs**:
- Create: `git-snitch/skills/repo-work-report/SKILL.md`

**Validation**:
- File exists and is valid Markdown
- Under 100 lines
- Frontmatter `description` field present and under 1024 chars
- Contains "Use when..." trigger phrase in description
- All 4 workflow phases documented
- not-ai-writer directives present
- No time-sensitive information
- No code, no imports — pure instruction text

---

### Sub-phase 1.2: worklog Skill

**Requirements**:
- Create directory `git-snitch/skills/worklog/`
- Create `SKILL.md` (single file, must be under 100 lines)
- Frontmatter `description`:
  ```
  Aggregates work reports across multiple repositories into a unified worklog. Use when the user asks for a cross-repo work summary, weekly/multi-repo report, or wants to combine repo-work-report outputs. Embeds not-ai-writer directives for natural output.
  ```
- Content sections:
  - **Quick Start**: User says "give me my work log across all repos for this sprint"
  - **Multi-Repo Gathering Workflow** (4 phases):
    - Phase 1: Identify repositories — use explicit repo paths if provided, or discover git repos via `.git` directory scanning (same logic as git-snitch scan)
    - Phase 2: Collect per-repo reports — run git log for each repo with same time range, classify commits per repo, read diffs for significant commits
    - Phase 3: Merge and deduplicate — combine all commits into unified timeline, identify cross-repo themes, group by theme/type rather than by repo, deduplicate merge commits and automated commits
    - Phase 4: Structure the worklog — title with time range, executive summary (2-4 sentences), themed sections (Features shipped, Bugs fixed, Infrastructure/DevOps, Refactoring, Documentation), per-repo breakdown subsections, cross-repo initiatives highlighted, total stats across all repos
  - **Writing Directives (not-ai-writer)**:
    - Same banned vocabulary as repo-work-report
    - Prioritize themes over repo-by-repo lists
    - Use natural language for cross-repo narratives
    - Example good: "The auth overhaul touched three repos: the API got new middleware, the frontend got a login rewrite, and the shared lib got token refresh logic."
    - Example bad: "In repo A, auth middleware was added. Furthermore, in repo B..."
  - **Output Format**: Markdown with H1 (time range), H2 themed sections, repo names as bold inline markers, commit references as `repo:abc1234`, stats table at bottom (repo | commits | additions | deletions)

**Outputs**:
- Create: `git-snitch/skills/worklog/SKILL.md`

**Validation**:
- File exists and is valid Markdown
- Under 100 lines
- Frontmatter `description` present and under 1024 chars
- Contains "Use when..." trigger phrase
- All 4 workflow phases documented
- not-ai-writer directives present
- Cross-repo aggregation logic documented

---

### Sub-phase 1.3: changelog Skill

**Requirements**:
- Create directory `git-snitch/skills/changelog/`
- Create `SKILL.md` (single file, must be under 100 lines)
- Frontmatter `description`:
  ```
  Generates a changelog from git repository data using commit classification and conventional commit parsing. Use when the user asks for a changelog, release notes, version history, or "what changed" document. Embeds not-ai-writer directives for natural, scannable output.
  ```
- Content sections:
  - **Quick Start**: User says "generate a changelog for the last month" or "create release notes for v2.0"
  - **Changelog Generation Workflow** (4 phases):
    - Phase 1: Gather commits — `git log` with full metadata, parse conventional commit prefixes (feat!, fix!, etc.), support version tag ranges (`git log v1.0..v2.0`), include `--all` if user wants all branches
    - Phase 2: Classify and filter — use commit classification (feat/fix/docs/refactor/etc.), filter out merge commits and chore commits (unless notable) and style-only changes, identify breaking changes (feat!, fix!, BREAKING CHANGE in body), group by semantic type
    - Phase 3: Structure the changelog — version header, date of release or range, Breaking Changes section (always first if any), Features section, Bug Fixes section, other sections as needed, each entry as one-line description with PR/commit reference, internal entries grouped, user-facing entries prominent
    - Phase 4: Format output — follow Keep a Changelog format (keepachangelog.com), or SemVer-based if user specifies version, commit references as short links
  - **Writing Directives (not-ai-writer)**:
    - Changelogs are technical documents — some formality acceptable
    - Still ban: tapestry, symphony, comprehensive, holistic, realm, orchestrate
    - Each entry: clear, specific description of the change
    - Start entries with imperative verbs: "Add", "Fix", "Remove", "Change", "Update"
    - No filler sentences between entries
    - No "We are excited to announce" or "This release brings"
  - **Output Format**: Markdown following Keep a Changelog — H2: [version] - YYYY-MM-DD, H3: Added/Changed/Fixed/Removed/Deprecated/Security, bullet entries starting with imperative verb, commit hash references in parentheses

**Outputs**:
- Create: `git-snitch/skills/changelog/SKILL.md`

**Validation**:
- File exists and is valid Markdown
- Under 100 lines
- Frontmatter `description` present and under 1024 chars
- Contains "Use when..." trigger phrase
- Keep a Changelog format reference
- Imperative verb entry style documented
- not-ai-writer directives present

---

### Sub-phase 1.4: devlog Skill (2 files)

**Requirements**:
- Create directory `git-snitch/skills/devlog/`
- Create `SKILL.md` (must be under 100 lines, references REFERENCES.md)
- Create `REFERENCES.md` (holds expanded not-ai-writer vocabulary and structure rules)

**SKILL.md** frontmatter `description`:
```
Crafts a natural, human-sounding devlog article from repository work data and example articles. Expects 1-4 example articles for voice matching, plus repo-work-report or worklog output as source material. Applies the strictest not-ai-writer directives. Use when the user wants a blog post, devlog entry, or article about their development work.
```

**SKILL.md** content sections:
- **Quick Start**: User provides 1-4 example articles + work report data
- **Article Crafting Workflow** (4 phases):
  - Phase 1: Analyze example articles — extract voice markers (sentence length/rhythm, paragraph structure, pronoun use, humor style, technical depth, opinion strength, formatting patterns, opening/closing patterns), build voice profile
  - Phase 2: Map work data to article structure — identify narrative arc (what problem, what tried/failed/worked, what learned), select 3-7 key moments/commits, find human story behind commits
  - Phase 3: Draft the article — match voice profile, structure with hook opening, context section, narrative body, technical details woven in, reflection section, closing matching example pattern. Target length matching example average.
  - Phase 4: not-ai-writer hardening — run full checklist from REFERENCES.md, vocabulary sweep, burstiness verification, voice audit, format review, read-aloud check
- **Writing Directives (STRICTEST not-ai-writer)**: All rules from repo-work-report apply, plus must match voice profile, zero tolerance for AI vocabulary markers, every paragraph needs voice element, no consecutive sections with same structural pattern, opening must NOT start with "This week" or "In this post", code examples contextualized with personal commentary
- Link to `REFERENCES.md` for complete vocabulary blacklist and structure rules

**REFERENCES.md** content:
- **Complete Banned Vocabulary (200+ words)** in 3 tiers:
  - Tier 1 (Instant AI Detection): delve, tapestry, symphony, comprehensive, holistic, intricate, realm, underscore, meticulous, impressively, moreover, furthermore, consequently, therefore, leverage, orchestrate, foster, unlock, unleash, harness, elevate, bolster, burgeon, captivate, catalyze, compel, demystify, elucidate, navigate, landscape, empower, seamless, robust, cutting-edge, innovative, transformative, game-changer, revolutionary, state-of-the-art, next-generation, groundbreaking
  - Tier 2 (Strong AI Indicators): significant, important, effective, essential, valuable, crucial, noteworthy, notably, remarkably, it's important to note, it's worth noting, in today's, in the modern, at the end of the day, all in all, various, numerous, multiple, facilitate, implement, utilize, optimize, streamline, enhance, ensure, encompass, integral, vital, paramount, profound, substantial, extensive
  - Tier 3 (Subtle AI Patterns): embark, journey, exploration, deep dive, wealth of, plethora, myriad, invaluable, indispensable, cornerstone, linchpin, beacon, testament, hallmark, quintessential, paradigm, archetype, epitome
- **Structure Rules (Burstiness Enforcement)**:
  - Sentence Length Targets: Mix 3-word, 8-word, 20-word, 5-word, 35-word sentences. No more than 2 consecutive sentences within 2 words of each other. At least 1 fragment per paragraph.
  - Paragraph Rules: No two consecutive paragraphs with same number of sentences. Vary between 1-sentence punch and 5-7 sentence narrative. Opening paragraphs: 1-3 sentences.
  - Section Opening Patterns: Rotate between question, direct statement, personal anecdote, code snippet with commentary, bold claim, specific number/data point
- **Voice Matching Checklist**: Pronoun usage, humor style, technical detail level, opinion frequency, paragraph length distribution, sentence complexity, opening/closing patterns, formatting conventions
- **Opening Line Patterns to AVOID**: "This week I...", "In this post...", "Recently I...", "I've been working on...", "It's been a while since...", variations of "I wanted to share..."
- **Good Opening Line Patterns**: Specific technical observation, emotional reaction, scene-setting, direct claim, question

**Outputs**:
- Create: `git-snitch/skills/devlog/SKILL.md`
- Create: `git-snitch/skills/devlog/REFERENCES.md`

**Validation**:
- Both files exist and are valid Markdown
- SKILL.md under 100 lines
- Frontmatter `description` present and under 1024 chars
- Contains "Use when..." trigger phrase
- REFERENCES.md contains all 3 tiers of banned vocabulary (200+ words total)
- Burstiness enforcement rules present
- Voice matching checklist present
- Opening line patterns (avoid + good) present
- No code, no imports — pure instruction text

---

**Phase-level Validation** (after all 4 sub-phases pass):
- All 5 files exist (4 × SKILL.md + 1 × REFERENCES.md)
- Consistent terminology across all 4 skills (same type names, same not-ai-writer vocabulary baseline)
- No time-sensitive information in any skill
- Each SKILL.md under 100 lines
- Each frontmatter description under 1024 chars and includes "Use when..." trigger phrase

**Commit**: `feat: add repo-work-report, worklog, changelog, devlog AI skills`

**Dependencies**: None (first phase)

---

## Phase 2: Core Worklog Types and Harness Infrastructure

**Type**: Sequential

**Context**: This phase creates the shared types, harness interface, prompt templates, and config integration in `@git-snitch/core`. Both the standalone `worklog` command (Phase 3) and the `--worklog-*` options (Phase 4) consume these.

### Requirements

**2A. Create `packages/core/src/worklog/types.ts`** — Shared type definitions:

```typescript
export const WORKLOG_HARNESSES = ["opencode", "pi", "codex"] as const;
export type WorklogHarness = (typeof WORKLOG_HARNESSES)[number];

export type WorklogSkillName = "repo-log" | "work-log" | "changelog" | "devlog";

export interface WorklogOptions {
  readonly prompt?: string;
  readonly harness: WorklogHarness;
  readonly model?: string;
  readonly skill?: WorklogSkillName;
  readonly outputPath?: string;
}

export interface WorklogResult {
  readonly markdown: string;
  readonly harness: WorklogHarness;
  readonly model: string;
  readonly generatedAt: string;
}

export interface AiHarness {
  readonly name: string;
  generate(prompt: string, options: HarnessCallOptions): Promise<string>;
}

export interface HarnessCallOptions {
  readonly model?: string;
  readonly skill?: string;
}
```

**2B. Create `packages/core/src/worklog/prompts.ts`** — Default prompt templates and resolver:

- Define `SkillDefinition` interface: `{ name: WorklogSkillName; description: string; defaultPrompt: string }`
- Define `SKILLS` array with 4 skill definitions:
  - `repo-log`: "Generate a structured repository activity log..." (focus on milestones, significant changes, contributor patterns)
  - `work-log`: "Generate a work log summarizing individual and team contributions..." (organize by contributor and time, include commit summaries, effort metrics)
  - `changelog`: "Generate a changelog following Keep a Changelog format..." (categorize into Added/Changed/Deprecated/Removed/Fixed/Security)
  - `devlog`: "Generate a developer journal / devlog narrative..." (tell story of development through commit activity, highlight decisions and turning points)
- Export `getSkillDefinitions(): readonly SkillDefinition[]`
- Export `resolveSkillPrompt(skill, userPrompt): string` — resolution order: userPrompt > skill.defaultPrompt > work-log default
- Export `buildWorklogPrompt(report: ReportData, customPrompt?: string): string` — interpolates `{reportData}` placeholder with `JSON.stringify(report, null, 2)`

**2C. Create `packages/core/src/worklog/harnesses/opencode.ts`** — Primary harness:

- Implements `AiHarness` interface
- Uses `node:child_process.spawn` to invoke the `opencode` CLI
- Passes prompt via `--prompt` flag
- Passes model via `--model` flag (if provided)
- Captures stdout and stderr
- Returns stdout as the generated markdown
- Must handle spawn errors (command not found, etc.) with clear error messages

**2D. Create `packages/core/src/worklog/harnesses/pi.ts`** — Stub harness:

- Implements `AiHarness` interface
- `generate()` throws: `"The pi harness is not yet implemented. Use: opencode"`

**2E. Create `packages/core/src/worklog/harnesses/codex.ts`** — Stub harness:

- Implements `AiHarness` interface
- `generate()` throws: `"The codex harness is not yet implemented. Use: opencode"`

**2F. Create `packages/core/src/worklog/harnesses/index.ts`** — Harness registry and factory:

- Map of `WorklogHarness` string → `() => AiHarness` factory
- Export `createHarness(name: WorklogHarness): AiHarness` — looks up factory, throws if unknown name

**2G. Create `packages/core/src/worklog/index.ts`** — Barrel export:

- Re-exports all types, `createHarness`, `resolveSkillPrompt`, `buildWorklogPrompt`, `getSkillDefinitions`
- Export `generateWorklog(report: ReportData, options: WorklogOptions): Promise<WorklogResult>` — the main orchestrator that:
  1. Resolves effective harness via `createHarness(options.harness)`
  2. Resolves effective prompt via `buildWorklogPrompt(report, options.prompt)`
  3. Calls `harness.generate(prompt, { model: options.model, skill: options.skill })`
  4. Returns `WorklogResult` with markdown, harness name, model used, ISO timestamp

**2H. Add Zod schema for worklog options** — In `packages/core/src/options.ts`:

- Add `import { WORKLOG_HARNESSES } from "./worklog/types.js"`
- Add:
  ```typescript
  export const worklogOptionsSchema = z.object({
    prompt: z.string().min(1).optional(),
    harness: z.enum(WORKLOG_HARNESSES).default("opencode"),
    model: z.string().min(1).optional(),
    skill: z.string().min(1).optional(),
    outputPath: z.string().min(1).optional(),
  });
  ```

**2I. Add worklog config section** — In `packages/core/src/config.ts`:

- Add `import { WORKLOG_HARNESSES } from "./worklog/types.js"`
- Add default worklog config: `{ harness: "opencode" as const }`
- Add `worklog` field to `gitSnitchConfigSchema`:
  ```typescript
  worklog: z.object({
    prompt: z.string().min(1).optional(),
    harness: z.enum(WORKLOG_HARNESSES).default("opencode"),
    model: z.string().min(1).optional(),
    skill: z.string().min(1).optional(),
    outputPath: z.string().min(1).optional(),
  }).default(defaultWorklogConfig),
  ```
- Update `GitSnitchConfigOverrides` to include `worklog?: Partial<GitSnitchConfig["worklog"]>`
- Update `mergeGitSnitchConfig` to merge worklog section (same pattern as report)

**2J. Export new types** — In `packages/core/src/index.ts`:

- Add type exports for: `WorklogHarness`, `WorklogSkillName`, `WorklogOptions`, `WorklogResult`, `AiHarness`, `HarnessCallOptions`
- Add value exports for: `WORKLOG_HARNESSES`, `createHarness`, `resolveSkillPrompt`, `buildWorklogPrompt`, `getSkillDefinitions`, `generateWorklog`, `worklogOptionsSchema`

**Inputs**:
- Read: `packages/core/src/options.ts`, `packages/core/src/config.ts`, `packages/core/src/index.ts`, `packages/core/src/report-data.ts`
- Reference: Existing patterns in `options.ts` (Zod schemas) and `config.ts` (config merging)

**Outputs**:
- Create: `packages/core/src/worklog/types.ts`
- Create: `packages/core/src/worklog/prompts.ts`
- Create: `packages/core/src/worklog/harnesses/opencode.ts`
- Create: `packages/core/src/worklog/harnesses/pi.ts`
- Create: `packages/core/src/worklog/harnesses/codex.ts`
- Create: `packages/core/src/worklog/harnesses/index.ts`
- Create: `packages/core/src/worklog/index.ts`
- Modify: `packages/core/src/options.ts` (add `worklogOptionsSchema`)
- Modify: `packages/core/src/config.ts` (add worklog config section)
- Modify: `packages/core/src/index.ts` (export new types and functions)

**Validation Criteria**:
- `pnpm turbo check-types` passes (zero type errors)
- `pnpm turbo build` passes
- All types properly exported from `@git-snitch/core`
- `worklogOptionsSchema` validates correct defaults (harness defaults to "opencode")
- Harness factory creates correct harness type
- Stub harnesses throw clear "not yet implemented" errors
- Config schema includes worklog section
- `GitSnitchConfigOverrides` includes worklog field
- `generateWorklog` function signature matches expected interface
- No `any` types anywhere
- All type-only imports use `import type`

**Commit**: `feat: add worklog types, harness infrastructure, and config support to core`

**Dependencies**: None (independent of Phase 1 skills)

---

## Phase 3: Standalone `worklog` CLI Command

**Type**: Sequential

**Context**: Adds a new `worklog` command to `@git-snitch/cli` that takes a git-snitch JSON export file, invokes an AI harness using the core infrastructure from Phase 2, and writes the generated markdown to a file. This is a separate command from `repo` and `scan`.

### Requirements

**3A. Create `apps/cli/src/worklog-command.ts`** — Runner for the worklog command:

- Import `generateWorklog`, `WorklogOptions`, `WorklogResult`, `isRepoReportData`, `isScanReportData` from `@git-snitch/core`
- Import `ReportData` type from `@git-snitch/core`
- Export `WorklogCommandOptions` interface:
  ```typescript
  interface WorklogCommandOptions {
    readonly output?: string;
    readonly prompt?: string;
    readonly harness?: string;
    readonly executor?: string;
    readonly e?: string;
    readonly model?: string;
    readonly skill?: string;
  }
  ```
- Export `runWorklogCommand(exportFilePath: string, options: WorklogCommandOptions, dependencies: Required<CliDependencies>): Promise<void>`:
  1. **Read and validate export file**:
     - `readFile(exportFilePath, "utf8")` — throw clear error if file not found: `"Unable to read export file {path}: {message}"`
     - `JSON.parse(raw)` — throw if invalid JSON: `"Export file {path} does not contain valid JSON."`
     - Validate with `isRepoReportData()` or `isScanReportData()` — throw if invalid: `"Export file {path} does not contain valid git-snitch report data. Expected kind 'repo' or 'scan' with valid report structure."`
  2. **Resolve harness**: Use the harness name directly (validated by Commander parser), default to `"opencode"`
  3. **Derive output path**: If `--output` provided, resolve to absolute. Otherwise derive: strip `.json` from input path, append `-worklog.md`
  4. **Call `generateWorklog()`** from core with the report data and resolved options
  5. **Write output**:
     - Write `result.markdown` to the output path using `writeFile`
     - Create parent directories with `mkdir({ recursive: true })`
  6. **Print status**: `dependencies.io.stdout("Wrote worklog {outputPath}\n")`

**3B. Modify `apps/cli/src/index.ts`** — Register the worklog command:

Add at top (with other imports):
```typescript
import { runWorklogCommand } from "./worklog-command.js";
```

Add after existing `parseNonNegativeInteger` function:
```typescript
function parseHarnessOption(value: string): string {
  const valid = ["opencode", "pi", "codex"];
  if (!valid.includes(value)) {
    throw new InvalidArgumentError(`Expected one of: ${valid.join(", ")}.`);
  }
  return value;
}

function parseSkillOption(value: string): string {
  const valid = ["repo-log", "work-log", "changelog", "devlog"];
  if (!valid.includes(value)) {
    throw new InvalidArgumentError(`Expected one of: ${valid.join(", ")}.`);
  }
  return value;
}
```

Add inside `createProgram()`, after the `scan` command block and before `return program;`:
```typescript
program
  .command("worklog")
  .description("Generate an AI-powered work log from a git-snitch export file.")
  .argument("<exportFile>", "Path to a git-snitch JSON export file")
  .option("-o, --output <path>", "Output file path for the generated work log")
  .option("--prompt <text>", "Override the default AI prompt")
  .option("--harness <kind>", "AI harness to use", parseHarnessOption, "opencode")
  .option("--executor <kind>", "Alias for --harness", parseHarnessOption)
  .option("-e <kind>", "Alias for --harness", parseHarnessOption)
  .option("--model <name>", "Override the default AI model")
  .option("--skill <name>", "Skill template to use", parseSkillOption)
  .action(async (exportFile: string, options: Record<string, unknown>) => {
    const resolvedHarness = (options.harness ?? options.executor ?? options.e ?? "opencode") as string;
    await runWorklogCommand(
      exportFile,
      {
        output: options.output as string | undefined,
        prompt: options.prompt as string | undefined,
        harness: resolvedHarness,
        executor: undefined,
        e: undefined,
        model: options.model as string | undefined,
        skill: options.skill as string | undefined,
      },
      { io, opener },
    );
  });
```

Update `formatCliError()` — change the unknown command message:
```typescript
return "Unknown command. Use `git-snitch repo`, `git-snitch scan`, or `git-snitch worklog`. Run `git-snitch --help` for usage.";
```

**3C. Create `apps/cli/test/worklog-command.test.ts`** — Tests:

Test cases:
1. **Rejects missing export file** — `runCli(["worklog", "nonexistent.json"])` → exit code 1, stderr mentions "Unable to read export file"
2. **Rejects invalid JSON** — write non-JSON to temp file → exit code 1, stderr mentions "valid JSON"
3. **Rejects valid JSON that isn't report data** — write `{}` to temp file → exit code 1, stderr mentions "valid git-snitch report data"
4. **Rejects invalid harness** — `runCli(["worklog", "file.json", "--harness", "invalid"])` → exit code 1, stderr mentions valid options
5. **Rejects invalid skill** — `runCli(["worklog", "file.json", "--skill", "invalid"])` → exit code 1, stderr mentions valid options
6. **Help output lists worklog** — `runCli(["--help"])` → stdout contains "worklog"

Tests should create fixture export files (valid repo/scan JSON) for positive test cases. Use `createBufferedOutput()` pattern from existing tests. Do NOT test actual AI harness invocation (that requires external tool) — mock the core `generateWorklog` or test only the input validation paths.

**Inputs**:
- Read: `apps/cli/src/index.ts`, `packages/core/src/worklog/index.ts`, `packages/core/src/report-data.ts`, `apps/cli/test/index.test.ts` (for test patterns)
- Reference: Existing command patterns in `index.ts` (repo, scan commands)

**Outputs**:
- Create: `apps/cli/src/worklog-command.ts`
- Create: `apps/cli/test/worklog-command.test.ts`
- Modify: `apps/cli/src/index.ts` (add imports, parser helpers, command registration, update error message)

**Validation Criteria**:
- `pnpm turbo check-types` passes (zero type errors)
- `pnpm turbo build` passes
- `pnpm turbo test` passes (all existing + new tests)
- `git-snitch --help` output includes "worklog"
- `git-snitch worklog --help` shows correct options with descriptions
- Export file validation catches: missing file, invalid JSON, non-report JSON
- Harness/skill option validation rejects invalid values
- Command follows same patterns as `repo` and `scan` (error handling, option parsing, action handler)
- No `any` types anywhere
- All type-only imports use `import type`

**Commit**: `feat: add standalone worklog CLI command with harness/skill options`

**Dependencies**: Phase 2 must complete (requires core worklog types and `generateWorklog`)

---

## Phase 4: `--worklog-*` / `--wl-*` Options on `repo` and `scan` Commands

**Type**: Sequential

**Context**: Adds worklog output mode as an alternative to the normal HTML report. When any `--worklog-*` option is present on `repo` or `scan`, the command generates report data as normal, then routes through the worklog pipeline instead of the HTML renderer. Produces a standalone HTML file with AI-generated prose content rendered via `marked`.

### Requirements

**4A. Create `packages/core/src/worklog/render.ts`** — Markdown-to-HTML rendering:

- Install `marked` in core: `pnpm --filter @git-snitch/core add marked`
- Import `marked` from "marked"
- Import `WorklogResult` from "./types.js"
- Export `renderWorklogHtml(result: WorklogResult): string`:
  - Renders `result.markdown` via `marked.parse()` to get HTML body
  - Wraps in a complete standalone HTML document with:
    - `<!doctype html>`, proper `<html lang="en">`, `<meta charset>`, viewport meta
    - `<title>git-snitch worklog</title>`
    - Inline `<style>` with prose CSS (readable body text, headings, lists, code blocks, tables — inspired by GitHub's markdown-body styles)
    - `<header>` with h1 "Worklog" and metadata paragraph: "Generated {generatedAt} using {harness}/{model}"
    - `<main class="markdown-body">` containing the rendered markdown
  - Returns the complete HTML string

**4B. Modify `apps/cli/src/index.ts`** — Add worklog options to both commands:

Add to `SharedCommandOptions` interface:
```typescript
readonly worklogPrompt?: string;
readonly worklogHarness?: string;
readonly worklogModel?: string;
readonly worklogSkill?: string;
readonly worklogOutput?: string;
// Alias fields:
readonly wlPrompt?: string;
readonly wlHarness?: string;
readonly wlModel?: string;
readonly wlSkill?: string;
readonly wlOutput?: string;
```

Add `rewriteWorklogAliases(argv: readonly string[]): string[]` function:
```typescript
function rewriteWorklogAliases(argv: readonly string[]): string[] {
  const aliasMap: ReadonlyMap<string, string> = new Map([
    ["--wl-prompt", "--worklog-prompt"],
    ["--wl-harness", "--worklog-harness"],
    ["--wl-model", "--worklog-model"],
    ["--wl-skill", "--worklog-skill"],
    ["--wl-output", "--worklog-output"],
  ]);
  return argv.map((arg) => aliasMap.get(arg) ?? arg);
}
```

Update `runCli()` to call `rewriteWorklogAliases` before `parseAsync`:
```typescript
const rewritten = rewriteWorklogAliases(argv);
await createProgram(dependencies).parseAsync(["node", "git-snitch", ...rewritten], { from: "node" });
```

On **both** the `repo` and `scan` command registrations, add these options (after existing options):
```typescript
.option("--worklog-prompt <string>", "Override default AI prompt for worklog generation")
.option("--worklog-harness <string>", "AI harness: opencode, pi, or codex", parseHarnessOption)
.option("--worklog-model <string>", "Override default model for the AI harness")
.option("--worklog-skill <string>", "AI skill/module for the harness", parseSkillOption)
.option("--worklog-output <path>", "Output file path for the worklog document")
```

Add `resolveWorklogOptions()` helper:
```typescript
function resolveWorklogOptions(
  options: SharedCommandOptions,
  configWorklog: GitSnitchConfig["worklog"],
): WorklogOptions | undefined {
  const hasAnyWorklogOption =
    options.worklogPrompt !== undefined ||
    options.worklogHarness !== undefined ||
    options.worklogModel !== undefined ||
    options.worklogSkill !== undefined ||
    options.worklogOutput !== undefined;

  if (!hasAnyWorklogOption) {
    return undefined;
  }

  return worklogOptionsSchema.parse({
    prompt: options.worklogPrompt ?? configWorklog.prompt,
    harness: options.worklogHarness ?? configWorklog.harness,
    model: options.worklogModel ?? configWorklog.model,
    skill: options.worklogSkill ?? configWorklog.skill,
    outputPath: options.worklogOutput ?? configWorklog.outputPath,
  });
}
```

**4C. Modify `runRepoCommand` in `apps/cli/src/index.ts`** — Add worklog branch:

After generating `const report = await generateRepoReport(reportOptions);`, before the existing format check:

```typescript
// === WORKLOG BRANCH ===
const worklogOpts = resolveWorklogOptions(options, config.worklog);
if (worklogOpts !== undefined) {
  // Warn about conflicting options
  if (options.json) {
    dependencies.io.stderr("Warning: Both --json and worklog options provided. Worklog output takes precedence.\n");
  }
  const result = await generateWorklog(report, worklogOpts);
  const html = renderWorklogHtml(result);
  const worklogPath = resolve(
    worklogOpts.outputPath ?? deterministicWorklogPath("repo", report.repository.name),
  );
  if (!reportOptions.overwrite && await pathExists(worklogPath)) {
    throw new Error(`Worklog file already exists: ${worklogPath}. Remove it or use --no-overwrite to replace it.`);
  }
  await mkdir(dirname(worklogPath), { recursive: true });
  await writeFile(worklogPath, html, "utf8");
  dependencies.io.stdout(`Wrote worklog ${worklogPath}\n`);
  if (shouldOpenReport) {
    await dependencies.opener(worklogPath);
  }
  return;
}
```

**4D. Modify `runScanCommand` in `apps/cli/src/index.ts`** — Add worklog branch:

Same pattern as repo command, after `const report = await generateScanReport(...)`:

```typescript
// === WORKLOG BRANCH ===
const worklogOpts = resolveWorklogOptions(options, config.worklog);
if (worklogOpts !== undefined) {
  if (options.json) {
    dependencies.io.stderr("Warning: Both --json and worklog options provided. Worklog output takes precedence.\n");
  }
  const result = await generateWorklog(report, worklogOpts);
  const html = renderWorklogHtml(result);
  const worklogPath = resolve(
    worklogOpts.outputPath ?? deterministicWorklogPath("scan", basename(resolvedDirectory)),
  );
  if (!config.report.overwrite && await pathExists(worklogPath)) {
    throw new Error(`Worklog file already exists: ${worklogPath}. Remove it or use --no-overwrite to replace it.`);
  }
  await mkdir(dirname(worklogPath), { recursive: true });
  await writeFile(worklogPath, html, "utf8");
  dependencies.io.stdout(`Wrote worklog ${worklogPath}\n`);
  if (shouldOpenReport) {
    await dependencies.opener(worklogPath);
  }
  return;
}
```

**4E. Add helper in `apps/cli/src/index.ts`**:

```typescript
function deterministicWorklogPath(kind: "repo" | "scan", name: string): string {
  return `git-snitch-worklog-${kind}-${slugify(name)}.html`;
}
```

**4F. Add imports at top of `apps/cli/src/index.ts`**:

```typescript
import { generateWorklog, renderWorklogHtml, worklogOptionsSchema } from "@git-snitch/core";

import type { WorklogOptions } from "@git-snitch/core";
```

Note: `renderWorklogHtml` and `worklogOptionsSchema` must be exported from `@git-snitch/core`. If they were not already exported in Phase 2, add them to `packages/core/src/index.ts` in this phase.

**4G. Create `packages/core/test/worklog.test.ts`** — Core worklog tests:

Test cases:
1. `worklogOptionsSchema` validates correct defaults (harness defaults to "opencode")
2. `worklogOptionsSchema` rejects invalid harness values
3. `worklogOptionsSchema` accepts all valid harness values ("opencode", "pi", "codex")
4. `buildWorklogPrompt()` interpolates report data correctly
5. `buildWorklogPrompt()` uses custom prompt when provided
6. `buildWorklogPrompt()` uses default template when no custom prompt
7. `resolveSkillPrompt()` returns user prompt when provided (ignores skill)
8. `resolveSkillPrompt()` returns skill default when skill provided
9. `resolveSkillPrompt()` returns work-log default when neither provided
10. `resolveSkillPrompt()` throws for unknown skill name
11. `createHarness("opencode")` returns a valid harness
12. `createHarness("pi")` returns a harness that throws "not yet implemented"
13. `createHarness("codex")` returns a harness that throws "not yet implemented"
14. `createHarness("invalid")` throws unknown harness error
15. `renderWorklogHtml()` returns valid HTML with expected structure
16. `renderWorklogHtml()` includes metadata (harness, model, generatedAt)
17. Config schema parses worklog section with defaults

**4H. Add tests to `apps/cli/test/index.test.ts`** — CLI integration tests:

Test cases for worklog options on repo/scan:
1. `--worklog-prompt` activates worklog mode on `repo`
2. `--worklog-prompt` activates worklog mode on `scan`
3. `--wl-prompt` alias is rewritten to `--worklog-prompt`
4. `--worklog-harness invalid` produces clear error
5. `--worklog-skill invalid` produces clear error
6. `rewriteWorklogAliases()` maps all 5 `--wl-*` aliases correctly
7. When worklog mode is active, normal HTML report is NOT generated

Note: These tests mock `generateWorklog` to avoid needing an actual AI harness. The mock returns a fixed markdown string.

**Inputs**:
- Read: `apps/cli/src/index.ts`, `packages/core/src/worklog/index.ts`, `packages/core/src/worklog/render.ts`, `packages/core/src/config.ts`, `packages/core/src/report-data.ts`, `apps/cli/test/index.test.ts`
- Reference: Existing `runRepoCommand` and `runScanCommand` patterns

**Outputs**:
- Create: `packages/core/src/worklog/render.ts`
- Create: `packages/core/test/worklog.test.ts`
- Modify: `apps/cli/src/index.ts` (add worklog options, alias rewriter, worklog branches in both commands, helpers, imports)
- Modify: `apps/cli/test/index.test.ts` (add worklog option tests)

**Validation Criteria**:
- `pnpm turbo check-types` passes (zero type errors)
- `pnpm turbo build` passes
- `pnpm turbo test` passes (all existing + new tests)
- `git-snitch repo --help` shows `--worklog-*` options
- `git-snitch scan --help` shows `--worklog-*` options
- `--wl-*` aliases are rewritten correctly
- Worklog mode is activated only when at least one `--worklog-*` option is present
- In worklog mode, the normal HTML report is not generated
- Config file worklog section is loaded and merged with CLI options
- Conflicting options (`--json` + worklog) produce a warning
- Output HTML file contains rendered markdown, not raw markdown
- Output HTML is standalone (inline CSS, no external dependencies)
- No `any` types anywhere
- All type-only imports use `import type`

**Commit**: `feat: add --worklog-* options to repo and scan commands with HTML rendering`

**Dependencies**: Phase 2 must complete (requires core worklog types, `generateWorklog`, `renderWorklogHtml`, `worklogOptionsSchema`)

---

## Success Criteria

Overall success requires:
- All 4 phases complete and validate successfully
- `pnpm turbo check-types` passes from repo root
- `pnpm turbo build` passes from repo root
- `pnpm turbo test` passes from repo root
- 5 skill files exist under `skills/`
- `git-snitch worklog --help` shows correct options
- `git-snitch repo --help` shows `--worklog-*` options
- `git-snitch scan --help` shows `--worklog-*` options
- `--wl-*` aliases work correctly
- Manual verification: `git-snitch repo . --json > /tmp/test-export.json && git-snitch worklog /tmp/test-export.json --prompt "Summarize this" --output /tmp/test-worklog.md`

## Total Files Summary

| Phase | Create | Modify | Total |
|-------|--------|--------|-------|
| Phase 1 | 5 (skills) | 0 | 5 |
| Phase 2 | 7 (core worklog) | 3 (options, config, index) | 10 |
| Phase 3 | 2 (command + test) | 1 (cli index) | 3 |
| Phase 4 | 2 (render + test) | 2 (cli index + cli test) | 4 |
| **Total** | **16** | **6** | **22** |

## Commit Sequence

1. `feat: add repo-work-report, worklog, changelog, devlog AI skills` (after Phase 1)
2. `feat: add worklog types, harness infrastructure, and config support to core` (after Phase 2)
3. `feat: add standalone worklog CLI command with harness/skill options` (after Phase 3)
4. `feat: add --worklog-* options to repo and scan commands with HTML rendering` (after Phase 4)
