# Plan: Add `--worklog-*` / `--wl-*` Options to `repo` and `scan` Commands

## 1. Overview

Add a family of `--worklog-*` (aliased `--wl-*`) CLI options to the existing `repo` and `scan` commands. When any worklog option is provided, the system generates report data as normal, then invokes an AI harness with a configurable prompt/model/skill to produce a markdown worklog document, renders that markdown to HTML, and writes it to the output file.

The worklog path is an **alternative output mode** — it produces a prose AI-generated document rather than the interactive HTML report with charts/tables/navigation.

---

## 2. Exact Files to Modify

### Primary Changes

| File | Action | Purpose |
|------|--------|---------|
| `apps/cli/src/index.ts` | **Modify** | Add worklog CLI options to both commands; add worklog execution branch |
| `packages/core/src/options.ts` | **Modify** | Add `WorklogOptions` type and Zod schema |
| `packages/core/src/index.ts` | **Modify** | Export new worklog types |
| `packages/core/src/config.ts` | **Modify** | Add worklog config section to `gitSnitchConfigSchema` |
| `packages/core/src/report-data.ts` | **Modify** | (No change needed — report data flows through unchanged) |

### New Files

| File | Purpose |
|------|---------|
| `packages/core/src/worklog.ts` | Core worklog execution: AI harness dispatch, prompt building, markdown generation |
| `packages/core/src/worklog/types.ts` | Shared worklog types (harness enum, model types, skill types) |
| `packages/core/src/worklog/harnesses/opencode.ts` | OpenCode harness implementation |
| `packages/core/src/worklog/harnesses/pi.ts` | Pi harness implementation |
| `packages/core/src/worklog/harnesses/codex.ts` | Codex harness implementation |
| `packages/core/src/worklog/harnesses/index.ts` | Harness registry and factory |
| `packages/core/src/worklog/prompts.ts` | Default worklog prompt templates |
| `packages/core/test/worklog.test.ts` | Worklog unit tests |
| `packages/renderer/src/markdown.tsx` | React component for rendering markdown to HTML in report context |
| `packages/renderer/src/worklog-template.html` | Standalone HTML template for worklog output (simpler than full report) |

---

## 3. Option Definitions

### CLI Options (added to both `repo` and `scan` commands)

All options are optional. Presence of **any** worklog option activates worklog mode.

```
--worklog-prompt <string>    Override default worklog prompt
                             Alias: --wl-prompt
                             Default: built-in worklog prompt (see section 5)

--worklog-harness <string>   Select AI harness backend
                             Alias: --wl-harness
                             Choices: "opencode", "pi", "codex"
                             Default: "opencode"

--worklog-model <string>     Override default model for the chosen harness
                             Alias: --wl-model
                             Default: harness-specific default

--worklog-skill <string>     Specify which skill/module the harness should use
                             Alias: --wl-skill
                             Default: none (harness default behavior)

--worklog-output <path>      Output file path for the worklog document
                             Alias: --wl-output
                             Default: git-snitch-worklog-{slug}.html
```

### Commander Registration Pattern

Following the exact pattern already used in `apps/cli/src/index.ts`:

```typescript
// Add to SharedCommandOptions interface:
interface SharedCommandOptions {
  readonly output?: string;
  readonly json?: boolean;
  readonly open?: boolean;
  readonly overwrite?: boolean;
  readonly template?: string;
  readonly since?: string;
  readonly until?: string;
  // NEW:
  readonly worklogPrompt?: string;
  readonly worklogHarness?: string;
  readonly worklogModel?: string;
  readonly worklogSkill?: string;
  readonly worklogOutput?: string;
}

// On BOTH the repo and scan command registrations, add:
.option("--worklog-prompt <string>", "Override default AI prompt for worklog generation")
.option("--wl-prompt <string>", "Alias for --worklog-prompt")
.option("--worklog-harness <string>", "AI harness: opencode, pi, or codex")
.option("--wl-harness <string>", "Alias for --worklog-harness")
.option("--worklog-model <string>", "Override default model for the AI harness")
.option("--wl-model <string>", "Alias for --worklog-model")
.option("--worklog-skill <string>", "Specify AI skill/module for the harness")
.option("--wl-skill <string>", "Alias for --worklog-skill")
.option("--worklog-output <path>", "Output file path for the worklog document")
.option("--wl-output <path>", "Alias for --worklog-output")
```

**Important**: Commander.js does not natively support aliases. The alias options must be merged manually in a normalization step. Add a new `normalizeWorklogOptions()` function:

```typescript
function normalizeWorklogOptions<Options extends SharedCommandOptions>(
  options: Options,
  command: Command,
): Options & { readonly worklog?: WorklogCliOptions } {
  const hasAnyWorklogOption =
    options.worklogPrompt !== undefined ||
    options.worklogHarness !== undefined ||
    options.worklogModel !== undefined ||
    options.worklogSkill !== undefined ||
    options.worklogOutput !== undefined ||
    command.getOptionValueSource("worklogPrompt") === "cli" ||
    command.getOptionValueSource("worklogHarness") === "cli" ||
    command.getOptionValueSource("worklogModel") === "cli" ||
    command.getOptionValueSource("worklogSkill") === "cli" ||
    command.getOptionValueSource("worklogOutput") === "cli";

  if (!hasAnyWorklogOption) {
    return { ...options, worklog: undefined };
  }

  return {
    ...options,
    worklog: {
      prompt: options.worklogPrompt,
      harness: options.worklogHarness,
      model: options.worklogModel,
      skill: options.worklogSkill,
      outputPath: options.worklogOutput,
    },
  };
}
```

> **Commander alias alternative**: Instead of registering duplicate options, consider a `preParse` or post-processing step where `--wl-*` values are copied to `--worklog-*` keys. This avoids Commander conflicts. The pattern used in the codebase is to register only the long-form options and resolve aliases by checking both the long and short names.

**Recommended approach**: Register only the long-form `--worklog-*` options in Commander. Then add a preprocessing step before `parseAsync` that rewrites `--wl-*` args to `--worklog-*` args:

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

This is called in `runCli` before `parseAsync`:
```typescript
const rewritten = rewriteWorklogAliases(argv);
await createProgram(dependencies).parseAsync(["node", "git-snitch", ...rewritten], { from: "node" });
```

---

## 4. Core Types and Schemas

### New File: `packages/core/src/worklog/types.ts`

```typescript
export const WORKLOG_HARNESSES = ["opencode", "pi", "codex"] as const;
export type WorklogHarness = (typeof WORKLOG_HARNESSES)[number];

export interface WorklogOptions {
  readonly prompt?: string;
  readonly harness: WorklogHarness;
  readonly model?: string;
  readonly skill?: string;
  readonly outputPath?: string;
}

export interface WorklogResult {
  readonly markdown: string;
  readonly harness: WorklogHarness;
  readonly model: string;
  readonly generatedAt: string;
}
```

### Modification: `packages/core/src/options.ts`

Add the Zod schema for validation:

```typescript
import { WORKLOG_HARNESSES } from "./worklog/types.js";

export const worklogOptionsSchema = z.object({
  prompt: z.string().min(1).optional(),
  harness: z.enum(WORKLOG_HARNESSES).default("opencode"),
  model: z.string().min(1).optional(),
  skill: z.string().min(1).optional(),
  outputPath: z.string().min(1).optional(),
});
```

### Modification: `packages/core/src/config.ts`

Add `worklog` section to the config schema:

```typescript
const defaultWorklogConfig = {
  harness: "opencode" as const,
};

// Inside gitSnitchConfigSchema, add:
worklog: z.object({
  prompt: z.string().min(1).optional(),
  harness: z.enum(WORKLOG_HARNESSES).default("opencode"),
  model: z.string().min(1).optional(),
  skill: z.string().min(1).optional(),
  outputPath: z.string().min(1).optional(),
}).default(defaultWorklogConfig),
```

Update `GitSnitchConfigOverrides`:
```typescript
export interface GitSnitchConfigOverrides {
  readonly repo?: Partial<GitSnitchConfig["repo"]>;
  readonly scan?: Partial<GitSnitchConfig["scan"]>;
  readonly report?: Partial<GitSnitchConfig["report"]>;
  readonly worklog?: Partial<GitSnitchConfig["worklog"]>;  // NEW
}
```

---

## 5. Worklog Execution Logic

### New File: `packages/core/src/worklog.ts`

This is the orchestrator that:
1. Takes report data + worklog options
2. Resolves effective options (CLI > config > defaults)
3. Builds the prompt from report data
4. Dispatches to the appropriate AI harness
5. Returns the raw markdown result

```typescript
export async function generateWorklog(
  report: ReportData,
  options: WorklogOptions,
  dependencies?: WorklogDependencies,
): Promise<WorklogResult> { ... }
```

### Default Prompt Template

New file: `packages/core/src/worklog/prompts.ts`

The default prompt should be structured to produce meaningful worklog prose:

```typescript
export const DEFAULT_WORKLOG_PROMPT = `You are generating a worklog document from git activity data.
Produce a well-structured markdown document that summarizes development activity.

## Report Data

{reportData}

## Instructions

Create a worklog that covers:
- Activity summary for the period
- Key changes by contributor
- Notable patterns (hotspots, quality signals)
- Recommendations

Use clear headings, bullet points, and tables where appropriate.
Format the output as clean markdown.` as const;

export function buildWorklogPrompt(
  report: ReportData,
  customPrompt?: string,
): string {
  const template = customPrompt ?? DEFAULT_WORKLOG_PROMPT;
  return template.replace("{reportData}", JSON.stringify(report, null, 2));
}
```

### AI Harness Interface

```typescript
export interface AiHarness {
  readonly name: string;
  generate(prompt: string, options: HarnessCallOptions): Promise<string>;
}

export interface HarnessCallOptions {
  readonly model?: string;
  readonly skill?: string;
}
```

### Harness Implementations

Each harness wraps an external tool/API:

**`opencode.ts`**: Invokes the `opencode` CLI or SDK with the prompt. This is the primary harness — it invokes the opencode agent system which can use skills, models, etc.

**`pi.ts`**: Invokes the `pi` (possibly a local AI tool) with the prompt.

**`codex.ts`**: Invokes OpenAI's Codex or a codex-compatible API.

> **Architecture Decision**: Each harness must be implemented as a function that takes the prompt + options and returns a markdown string. The initial implementation should focus on `opencode` as the primary harness. The `pi` and `codex` harnesses can start as stubs that throw clear "not yet implemented" errors.

### Harness Factory

```typescript
// packages/core/src/worklog/harnesses/index.ts
const harnessRegistry = new Map<string, () => AiHarness>([
  ["opencode", () => new OpenCodeHarness()],
  ["pi", () => new PiHarness()],
  ["codex", () => new CodexHarness()],
]);

export function createHarness(name: WorklogHarness): AiHarness {
  const factory = harnessRegistry.get(name);
  if (!factory) throw new Error(`Unknown AI harness: ${name}`);
  return factory();
}
```

---

## 6. Markdown Rendering Approach

### Library Choice: `marked`

**Rationale**: 
- Lightweight, zero-dependency, well-maintained
- Works in Node.js (for CLI) and browser (for potential future renderer use)
- Only produces HTML output — no React dependency needed
- The renderer package already bundles via Vite, so size is less critical

**Installation** (in `packages/core`):
```
pnpm --filter @git-snitch/core add marked
```

### Alternative Considered: `markdown-it`
- More extensible plugin system but heavier
- `marked` is sufficient for worklog prose (headings, lists, tables, code blocks, links)

### Rendering Strategy

The worklog output should be a **standalone HTML file** that:
1. Has basic styling (can reuse the existing Tailwind/shadcn theme CSS)
2. Renders the markdown content as formatted HTML
3. Includes metadata (generation date, harness used, model used)
4. Is self-contained (like the existing report HTML)

Two approaches:

#### Approach A: Simple standalone HTML (Recommended for v1)

Generate a minimal standalone HTML page with the rendered markdown. No React/Vite build step needed — just string interpolation in Node.js:

```typescript
// In packages/core/src/worklog/render.ts
import { marked } from "marked";

export function renderWorklogHtml(result: WorklogResult): string {
  const htmlBody = marked(result.markdown);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>git-snitch worklog</title>
  <style>${WORKLOG_STYLES}</style>
</head>
<body>
  <header>
    <h1>Worklog</h1>
    <p>Generated ${result.generatedAt} using ${result.harness}/${result.model}</p>
  </header>
  <main class="markdown-body">
    ${htmlBody}
  </main>
</body>
</html>`;
}
```

The `WORKLOG_STYLES` would be a minimal inline CSS string that provides readable prose styling (based on GitHub's markdown CSS patterns).

#### Approach B: Full Vite-built React template

Use the renderer build pipeline to create a React-based worklog viewer. This is more complex and not needed for v1.

**Recommendation**: **Approach A** — simple string-based HTML generation using `marked`. This keeps the worklog feature self-contained in `@git-snitch/core` and avoids adding complexity to the renderer build pipeline.

---

## 7. Conditional Logic: Worklog Mode vs Normal Mode

### Decision Flow in `runRepoCommand` and `runScanCommand`

After generating report data, check whether worklog mode is active:

```typescript
// In runRepoCommand (apps/cli/src/index.ts):
async function runRepoCommand(
  repoPath: string,
  options: RepoCommandOptions & { worklog?: WorklogCliOptions },
  dependencies: Required<CliDependencies>,
): Promise<void> {
  const resolvedRepoPath = resolve(repoPath);
  const config = mergeGitSnitchConfig(
    await loadGitSnitchConfig(resolvedRepoPath),
    buildSharedOverrides(options),
  );

  // Generate report data (shared between normal and worklog modes)
  const report = await generateRepoReport(reportOptions);

  // === WORKLOG BRANCH ===
  if (options.worklog !== undefined) {
    const worklogOptions = resolveWorklogOptions(options.worklog, config.worklog);
    const result = await generateWorklog(report, worklogOptions);
    const html = renderWorklogHtml(result);
    const outputPath = resolve(
      worklogOptions.outputPath ?? deterministicWorklogPath("repo", report.repository.name),
    );
    await writeWorklogFile({ outputPath, html, overwrite: reportOptions.overwrite });
    dependencies.io.stdout(`Wrote worklog ${outputPath}\n`);
    if (shouldOpenReport) {
      await dependencies.opener(outputPath);
    }
    return;
  }

  // === NORMAL BRANCH (existing code) ===
  if (reportOptions.format === "json") {
    dependencies.io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const outputPath = resolve(reportOptions.outputPath ?? deterministicOutputPath("repo", report.repository.name));
  await writeHtmlReport({ outputPath, overwrite: reportOptions.overwrite, templatePath: reportOptions.templatePath, report });
  dependencies.io.stdout(`Wrote ${outputPath}\n`);
  if (shouldOpenReport) {
    await dependencies.opener(outputPath);
  }
}
```

The same pattern applies to `runScanCommand`.

### `resolveWorklogOptions` — Merge CLI, config, and defaults

```typescript
function resolveWorklogOptions(
  cliOptions: WorklogCliOptions,
  configWorklog: GitSnitchConfig["worklog"],
): WorklogOptions {
  return worklogOptionsSchema.parse({
    prompt: cliOptions.prompt ?? configWorklog.prompt,
    harness: cliOptions.harness ?? configWorklog.harness,
    model: cliOptions.model ?? configWorklog.model,
    skill: cliOptions.skill ?? configWorklog.skill,
    outputPath: cliOptions.outputPath ?? configWorklog.outputPath,
  });
}
```

### Mutual Exclusivity

- `--json` + worklog options: worklog mode takes precedence (or error — recommend erroring with clear message)
- `--template` + worklog options: worklog mode takes precedence (template is for the interactive report, not worklog)
- `--output` + `--worklog-output`: `--worklog-output` controls the worklog file; `--output` is for the normal report (which is not generated in worklog mode)

**Recommended**: If any worklog option is present, ignore `--json`, `--template`, and `--output` (they are for the normal report flow). Only `--worklog-output` controls the worklog output path. Print a warning if conflicting options are used.

---

## 8. How Worklog Output Differs from Normal Output

| Aspect | Normal Output | Worklog Output |
|--------|--------------|----------------|
| **Format** | Interactive standalone HTML (React SPA) | Prose HTML document (static) |
| **Content** | Charts, tables, navigation, theme toggle | AI-generated text with markdown formatting |
| **Data source** | Report data injected as JSON, rendered client-side | Report data fed to AI prompt, markdown rendered server-side |
| **Build pipeline** | Vite + React + TanStack Router | Simple string template + `marked` |
| **File naming** | `git-snitch-repo-{name}.html` | `git-snitch-worklog-repo-{name}.html` |
| **Styling** | Full Tailwind + shadcn theme | Minimal prose CSS (GitHub-like) |
| **Interactivity** | Tabs, search, sort, export, theme toggle | None (static document) |
| **Size** | Large (full React bundle inlined) | Small (just CSS + rendered HTML) |

---

## 9. Implementation Phases

### Phase 1: Core Types and CLI Options

**Files**: 
- `packages/core/src/worklog/types.ts` (new)
- `packages/core/src/options.ts` (modify)
- `packages/core/src/config.ts` (modify)
- `packages/core/src/index.ts` (modify — export new types)
- `apps/cli/src/index.ts` (modify — add options)

**Steps**:
1. Create `packages/core/src/worklog/types.ts` with `WorklogHarness`, `WorklogOptions`, `WorklogResult` types
2. Add `worklogOptionsSchema` to `packages/core/src/options.ts`
3. Add `worklog` section to `gitSnitchConfigSchema` in `packages/core/src/config.ts`
4. Update `GitSnitchConfigOverrides` to include `worklog`
5. Export new types from `packages/core/src/index.ts`
6. Add `--worklog-*` options to both `repo` and `scan` commands in `apps/cli/src/index.ts`
7. Implement `rewriteWorklogAliases()` for `--wl-*` support
8. Add worklog fields to `SharedCommandOptions` interface
9. Verify: `pnpm turbo check-types` passes

### Phase 2: Worklog Core Logic

**Files**:
- `packages/core/src/worklog.ts` (new)
- `packages/core/src/worklog/prompts.ts` (new)
- `packages/core/src/worklog/harnesses/index.ts` (new)
- `packages/core/src/worklog/harnesses/opencode.ts` (new)
- `packages/core/src/worklog/harnesses/pi.ts` (new)
- `packages/core/src/worklog/harnesses/codex.ts` (new)

**Steps**:
1. Install `marked`: `pnpm --filter @git-snitch/core add marked`
2. Create prompt templates in `packages/core/src/worklog/prompts.ts`
3. Define the `AiHarness` interface
4. Implement `OpenCodeHarness` — this is the primary harness that invokes the opencode agent system
5. Implement `PiHarness` and `CodexHarness` as stubs that throw "not yet implemented" errors
6. Create the harness factory/registry in `packages/core/src/worklog/harnesses/index.ts`
7. Implement `generateWorklog()` in `packages/core/src/worklog.ts`
8. Verify: `pnpm turbo check-types` passes

### Phase 3: Markdown Rendering and Output

**Files**:
- `packages/core/src/worklog/render.ts` (new)
- `packages/core/src/worklog/styles.ts` (new)
- `apps/cli/src/index.ts` (modify — add worklog branch)

**Steps**:
1. Create `packages/core/src/worklog/styles.ts` with minimal prose CSS
2. Create `packages/core/src/worklog/render.ts` with `renderWorklogHtml()` using `marked`
3. Add `writeWorklogFile()` helper to `apps/cli/src/index.ts`
4. Add `deterministicWorklogPath()` helper (pattern: `git-snitch-worklog-{kind}-{slug}.html`)
5. Implement the worklog branch in `runRepoCommand()`
6. Implement the worklog branch in `runScanCommand()`
7. Add option conflict detection (warn if `--json` + worklog, etc.)
8. Verify: `pnpm turbo check-types` and `pnpm turbo build` pass

### Phase 4: Tests

**Files**:
- `packages/core/test/worklog.test.ts` (new)
- `apps/cli/test/index.test.ts` (modify — add worklog tests)

**Steps**:
1. Test `worklogOptionsSchema` validation (valid and invalid inputs)
2. Test `buildWorklogPrompt()` with report data
3. Test `renderWorklogHtml()` — verify output contains expected HTML elements
4. Test `rewriteWorklogAliases()` — verify `--wl-*` → `--worklog-*` mapping
5. Test CLI integration: worklog options are parsed correctly
6. Test mutual exclusivity: `--json` + `--worklog-prompt` behavior
7. Test worklog HTML output file is written correctly
8. Verify: `pnpm turbo test` passes

### Phase 5: Documentation and Polish

**Steps**:
1. Update help text descriptions for all worklog options
2. Verify the `--help` output is clear and complete
3. Verify error messages are actionable (e.g., unknown harness, harness failure)
4. Run full verification: `pnpm turbo check-types && pnpm turbo build && pnpm turbo test`

---

## 10. Key Design Decisions

### D1: Worklog options go in `SharedCommandOptions`, not a separate command

The worklog is an output mode of `repo` and `scan`, not a separate command. This avoids duplicating all the repo/scan input options (path, since, until, branch, etc.).

### D2: `marked` in `@git-snitch/core`, not in `@git-snitch/renderer`

The worklog markdown rendering happens at generation time (Node.js CLI), not at browser render time. This keeps the worklog pipeline self-contained and avoids adding weight to the already-large renderer bundle.

### D3: Simple HTML output, not Vite-built React app

The worklog is a static prose document. It does not need React, TanStack Router, charts, or interactive components. A simple HTML string with inline CSS is sufficient and much faster to generate.

### D4: Harness implementations are pluggable

The `AiHarness` interface allows each backend to be implemented independently. The `opencode` harness is primary; others can be added incrementally.

### D5: `--wl-*` aliases via argv rewriting

Rather than fighting Commander's option system with duplicate registrations, we rewrite the argv before parsing. This is clean, testable, and doesn't pollute the Commander option definitions.

---

## 11. Error Handling

| Scenario | Behavior |
|----------|----------|
| `--worklog-harness invalid` | Error: "Invalid worklog harness. Choose from: opencode, pi, codex" |
| `--worklog-harness pi` (not yet implemented) | Error: "The pi harness is not yet implemented. Use: opencode" |
| AI harness fails / times out | Error: "Worklog generation failed: {harness error message}" |
| `--json` + `--worklog-prompt` | Warning: "Both --json and worklog options provided. Worklog output takes precedence." |
| `--worklog-output` path not writable | Error: "Unable to write worklog to {path}: {system error}" |
| No report data (empty repo/scan) | Proceed with empty report data — the AI may produce a "no activity" worklog |

---

## 12. Dependency Additions

| Package | Dependency | Version | Justification |
|---------|------------|---------|---------------|
| `@git-snitch/core` | `marked` | `^15` (latest stable) | Markdown-to-HTML rendering for worklog output |

No other new dependencies are needed. The AI harness implementations will use child process spawning or HTTP fetch (built-in), not external SDKs.
