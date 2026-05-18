# Plan: Add `worklog` CLI Command to git-snitch

## Summary

Add a new `worklog` command to `@git-snitch/cli` that reads a git-snitch export file (JSON report data), invokes an AI harness (opencode, pi, or codex) with a configurable skill prompt, and writes the AI-generated output to a file.

---

## 1. Project Architecture Context

### Monorepo Layout
- **`apps/cli`** (`@git-snitch/cli`) — Commander.js-based CLI entry at `apps/cli/src/index.ts`
- **`packages/core`** (`@git-snitch/core`) — Git analysis, report data types, config
- **`packages/renderer`** (`@git-snitch/renderer`) — HTML report generation via Vite
- **`packages/config`** (`@git-snitch/config`) — Shared tsconfig
- **`packages/env`** (`@git-snitch/env`) — Environment tooling

### CLI Pattern (Commander.js)
- Single file: `apps/cli/src/index.ts` — all commands registered via `program.command()`
- Uses `Command` from `commander` (^14.0.2)
- Options defined via `.option()` / `.argument()`
- Action handlers call `runXxxCommand()` functions that orchestrate core logic
- All I/O is injected via `CliDependencies` for testability
- Errors throw with clear messages; `runCli()` catches and formats them

### Key Types
- `RepoReportData` — `{ kind: "repo", ... }` from `@git-snitch/core`
- `ScanReportData` — `{ kind: "scan", ... }` from `@git-snitch/core`
- `ReportData = RepoReportData | ScanReportData`
- Report data schemas exist in `packages/core/src/report-data.ts` with Zod validators (`repoReportDataSchema`, `scanReportDataSchema`)
- `isRepoReportData()` / `isScanReportData()` are type guards

### Test Pattern
- Tests in `apps/cli/test/index.test.ts` use vitest
- `createBufferedOutput()` creates injectable `CliIo` mock
- `runCli(argv, dependencies)` is the test entry point
- Fixture repos created with `createFixtureRepo()` helper

---

## 2. Files to Create

### 2.1 `apps/cli/src/worklog-types.ts`

**Purpose**: Type definitions for the worklog command — harness types, skill types, and options.

```typescript
import type { ReportData } from "@git-snitch/core";

// ── Harness Types ──

export type HarnessKind = "opencode" | "pi" | "codex";

export interface HarnessConfig {
  readonly kind: HarnessKind;
  readonly model?: string;
}

export interface HarnessResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export interface HarnessInvocation {
  readonly prompt: string;
  readonly inputFile: string;
  readonly outputFile: string;
  readonly model?: string;
}

// ── Skill Types ──

export type WorklogSkill = "repo-log" | "work-log" | "changelog" | "devlog";

// ── Command Options ──

export interface WorklogCommandOptions {
  readonly output?: string;
  readonly prompt?: string;
  readonly harness?: HarnessKind;
  readonly model?: string;
  readonly skill?: WorklogSkill;
}
```

### 2.2 `apps/cli/src/worklog-skills.ts`

**Purpose**: Default prompt templates for each skill, plus logic to resolve the effective prompt.

```typescript
import type { WorklogSkill } from "./worklog-types.js";

export interface SkillDefinition {
  readonly name: WorklogSkill;
  readonly description: string;
  readonly defaultPrompt: string;
}

const SKILLS: readonly SkillDefinition[] = [
  {
    name: "repo-log",
    description: "Generate a structured repository activity log",
    defaultPrompt:
      "Analyze the following git report data and generate a structured repository activity log. " +
      "Focus on development milestones, significant changes, and contributor activity patterns. " +
      "Write the output to the file specified in the prompt context.",
  },
  {
    name: "work-log",
    description: "Generate a work log summarizing individual and team contributions",
    defaultPrompt:
      "Analyze the following git report data and generate a detailed work log. " +
      "Organize by contributor and time period. Include commit summaries, areas of work, and effort metrics. " +
      "Write the output to the file specified in the prompt context.",
  },
  {
    name: "changelog",
    description: "Generate a changelog following Keep a Changelog conventions",
    defaultPrompt:
      "Analyze the following git report data and generate a changelog following the Keep a Changelog format. " +
      "Categorize changes into Added, Changed, Deprecated, Removed, Fixed, and Security sections. " +
      "Write the output to the file specified in the prompt context.",
  },
  {
    name: "devlog",
    description: "Generate a developer journal from commit history",
    defaultPrompt:
      "Analyze the following git report data and generate a developer journal / devlog narrative. " +
      "Tell the story of development progress through commit activity, highlighting key decisions and turning points. " +
      "Write the output to the file specified in the prompt context.",
  },
] as const;

export function getSkillDefinitions(): readonly SkillDefinition[] {
  return SKILLS;
}

export function resolveSkillPrompt(skill: WorklogSkill | undefined, userPrompt: string | undefined): string {
  if (userPrompt !== undefined && userPrompt.length > 0) {
    return userPrompt;
  }

  if (skill !== undefined) {
    const definition = SKILLS.find((s) => s.name === skill);
    if (definition === undefined) {
      throw new Error(`Unknown skill: ${skill}. Available skills: ${SKILLS.map((s) => s.name).join(", ")}`);
    }
    return definition.defaultPrompt;
  }

  // Default to work-log skill if neither skill nor prompt specified
  const defaultSkill = SKILLS.find((s) => s.name === "work-log");
  return defaultSkill!.defaultPrompt;
}
```

### 2.3 `apps/cli/src/worklog-harness.ts`

**Purpose**: Harness adapters — each harness (opencode, pi, codex) is implemented as a function that constructs and executes a subprocess command.

```typescript
import { spawn } from "node:child_process";

import type { HarnessConfig, HarnessInvocation, HarnessKind, HarnessResult } from "./worklog-types.js";

export interface HarnessRunner {
  readonly run: (invocation: HarnessInvocation) => Promise<HarnessResult>;
}

// ── Harness Registry ──

interface HarnessDefinition {
  readonly kind: HarnessKind;
  readonly command: string;
  readonly buildArgs: (invocation: HarnessInvocation) => readonly string[];
  readonly buildEnv: (invocation: HarnessInvocation) => Readonly<Record<string, string>>;
}

const HARNESS_DEFINITIONS: readonly HarnessDefinition[] = [
  {
    kind: "opencode",
    command: "opencode",
    buildArgs: (inv) => {
      const args: string[] = ["--prompt", inv.prompt];
      if (inv.model) {
        args.push("--model", inv.model);
      }
      return args;
    },
    buildEnv: () => ({}),
  },
  {
    kind: "pi",
    command: "pi",
    buildArgs: (inv) => {
      const args: string[] = ["--prompt", inv.prompt];
      if (inv.model) {
        args.push("--model", inv.model);
      }
      return args;
    },
    buildEnv: () => ({}),
  },
  {
    kind: "codex",
    command: "codex",
    buildArgs: (inv) => {
      const args: string[] = ["--prompt", inv.prompt];
      if (inv.model) {
        args.push("--model", inv.model);
      }
      return args;
    },
    buildEnv: () => ({}),
  },
] as const;

export function getDefaultHarness(): HarnessKind {
  return "opencode";
}

export function resolveHarness(kind: HarnessKind | undefined): HarnessKind {
  if (kind === undefined) {
    return getDefaultHarness();
  }
  const validKinds = HARNESS_DEFINITIONS.map((h) => h.kind);
  if (!validKinds.includes(kind)) {
    throw new Error(`Unknown harness: ${kind}. Available harnesses: ${validKinds.join(", ")}`);
  }
  return kind;
}

export async function executeHarness(invocation: HarnessInvocation, config: HarnessConfig): Promise<HarnessResult> {
  const definition = HARNESS_DEFINITIONS.find((h) => h.kind === config.kind);
  if (definition === undefined) {
    throw new Error(`No harness definition found for: ${config.kind}`);
  }

  const effectiveModel = config.model ?? invocation.model;
  const effectiveInvocation: HarnessInvocation = {
    ...invocation,
    model: effectiveModel,
  };

  const args = definition.buildArgs(effectiveInvocation);
  const env = definition.buildEnv(effectiveInvocation);

  return runCommand(definition.command, args, env);
}

function runCommand(command: string, args: readonly string[], env: Readonly<Record<string, string>>): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: code,
      });
    });

    child.on("error", (error) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: `Failed to spawn ${command}: ${error.message}`,
        exitCode: null,
      });
    });
  });
}
```

**Note on harness implementations**: The exact CLI flags for `opencode`, `pi`, and `codex` need to be verified against their respective CLIs. The `buildArgs` functions above provide the scaffolding; the implementer must fill in the exact flag names and argument formats for each tool. Each harness may have different conventions for:
- How prompts are passed (stdin, `--prompt` flag, positional arg)
- How model is specified
- How input files are referenced
- How output is directed

### 2.4 `apps/cli/src/worklog-runner.ts`

**Purpose**: Core orchestration logic for the worklog command — reads the export file, validates it, builds the prompt context, invokes the harness, and handles output fallback.

```typescript
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { isRepoReportData, isScanReportData } from "@git-snitch/core";

import type { ReportData } from "@git-snitch/core";
import type { CliDependencies } from "./index.js";
import type { HarnessConfig, HarnessKind, WorklogSkill } from "./worklog-types.js";

import { executeHarness, resolveHarness } from "./worklog-harness.js";
import { resolveSkillPrompt } from "./worklog-skills.js";

export interface WorklogRunOptions {
  readonly exportFilePath: string;
  readonly outputFilePath?: string;
  readonly prompt?: string;
  readonly harness?: HarnessKind;
  readonly model?: string;
  readonly skill?: WorklogSkill;
}

export async function runWorklogCommand(options: WorklogRunOptions, dependencies: Required<CliDependencies>): Promise<void> {
  // 1. Read and validate export file
  const reportData = await readExportFile(options.exportFilePath);

  // 2. Resolve harness
  const harnessKind = resolveHarness(options.harness);
  const harnessConfig: HarnessConfig = { kind: harnessKind, model: options.model };

  // 3. Resolve prompt
  const basePrompt = resolveSkillPrompt(options.skill, options.prompt);
  const outputFilePath = options.outputFilePath
    ? resolve(options.outputFilePath)
    : deriveOutputPath(options.exportFilePath);

  // 4. Build the full prompt with context
  const fullPrompt = buildContextualPrompt(basePrompt, reportData, outputFilePath);

  // 5. Invoke the harness
  dependencies.io.stdout(`Running ${harnessKind} harness...\n`);

  const result = await executeHarness(
    {
      prompt: fullPrompt,
      inputFile: resolve(options.exportFilePath),
      outputFile: outputFilePath,
      model: options.model,
    },
    harnessConfig,
  );

  if (result.stderr.length > 0) {
    dependencies.io.stderr(result.stderr);
  }

  if (result.exitCode !== 0) {
    throw new Error(`Harness ${harnessKind} exited with code ${result.exitCode ?? "unknown"}.`);
  }

  // 6. Check if the AI wrote the output file; if not, write raw stdout to it
  const aiWroteFile = await fileExists(outputFilePath);
  if (!aiWroteFile && result.stdout.trim().length > 0) {
    const { mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(outputFilePath), { recursive: true });
    await writeFile(outputFilePath, result.stdout, "utf8");
    dependencies.io.stdout(`Harness did not write output file; wrote raw output to ${outputFilePath}\n`);
  } else if (aiWroteFile) {
    dependencies.io.stdout(`Output written to ${outputFilePath}\n`);
  } else {
    dependencies.io.stderr("Warning: Harness produced no output.\n");
  }
}

async function readExportFile(filePath: string): Promise<ReportData> {
  const resolvedPath = resolve(filePath);

  let raw: string;
  try {
    raw = await readFile(resolvedPath, "utf8");
  } catch (error) {
    throw new Error(
      `Unable to read export file ${resolvedPath}: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Export file ${resolvedPath} does not contain valid JSON.`);
  }

  if (isRepoReportData(parsed)) {
    return parsed;
  }
  if (isScanReportData(parsed)) {
    return parsed;
  }

  throw new Error(
    `Export file ${resolvedPath} does not contain valid git-snitch report data. ` +
    `Expected kind "repo" or "scan" with valid report structure.`,
  );
}

function buildContextualPrompt(basePrompt: string, reportData: ReportData, outputFilePath: string): string {
  // The prompt tells the AI to write output to the specified file
  return [
    basePrompt,
    "",
    `Output file path: ${outputFilePath}`,
    "",
    "The git report data is provided below as JSON:",
    "```json",
    JSON.stringify(reportData, null, 2),
    "```",
  ].join("\n");
}

function deriveOutputPath(exportFilePath: string): string {
  const base = exportFilePath.replace(/\.json$/i, "");
  return `${base}-worklog.md`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && Object.getOwnPropertyDescriptor(error, "code")?.value === "ENOENT") {
      return false;
    }
    throw error;
  }
}
```

### 2.5 `apps/cli/test/worklog.test.ts`

**Purpose**: Tests for the worklog command following the existing test patterns.

Test cases to implement:
1. **Rejects missing export file** — `runCli(["worklog", "nonexistent.json"])` → exit code 1, stderr mentions "Unable to read export file"
2. **Rejects invalid JSON export file** — write non-JSON, expect clear error
3. **Rejects valid JSON that isn't report data** — write `{}`, expect error about "valid git-snitch report data"
4. **Accepts valid repo export JSON** — create fixture repo, generate JSON export, pass it as input
5. **Skill flag validates skill name** — invalid skill name produces clear error
6. **Harness flag validates harness name** — invalid harness name produces clear error
7. **Default skill is work-log** — when no `--skill` or `--prompt` provided, uses work-log prompt
8. **Prompt overrides default** — `--prompt "custom"` is used instead of skill default
9. **Help output lists worklog** — `runCli(["--help"])` stdout contains "worklog"
10. **Output file fallback** — when harness doesn't write to file, raw stdout is written

---

## 3. Files to Modify

### 3.1 `apps/cli/src/index.ts`

**Changes**:

#### A. Add new imports at top of file (after existing imports)

```typescript
import { runWorklogCommand } from "./worklog-runner.js";

import type { HarnessKind, WorklogSkill } from "./worklog-types.js";
```

#### B. Add option-parsing helper for harness/skill enums

After the existing `parseNonNegativeInteger` function, add:

```typescript
function parseHarnessOption(value: string): HarnessKind {
  const valid: readonly HarnessKind[] = ["opencode", "pi", "codex"];
  if (!valid.includes(value as HarnessKind)) {
    throw new InvalidArgumentError(`Expected one of: ${valid.join(", ")}.`);
  }
  return value as HarnessKind;
}

function parseSkillOption(value: string): WorklogSkill {
  const valid: readonly WorklogSkill[] = ["repo-log", "work-log", "changelog", "devlog"];
  if (!valid.includes(value as WorklogSkill)) {
    throw new InvalidArgumentError(`Expected one of: ${valid.join(", ")}.`);
  }
  return value as WorklogSkill;
}
```

#### C. Register the `worklog` command in `createProgram()`

Add after the `scan` command definition (before `return program;`):

```typescript
program
  .command("worklog")
  .description("Generate an AI-powered work log from a git-snitch export file.")
  .argument("<exportFile>", "Path to a git-snitch JSON export file")
  .option("-o, --output <path>", "Output file path for the generated work log")
  .option("--prompt <text>", "Override the default AI prompt")
  .option("--harness <kind>", "AI harness to use (opencode, pi, codex)", parseHarnessOption, "opencode")
  .option("--executor <kind>", "Alias for --harness", parseHarnessOption)
  .option("-e <kind>", "Alias for --harness", parseHarnessOption)
  .option("--model <name>", "Override the default AI model")
  .option("--skill <name>", "Skill template to use (repo-log, work-log, changelog, devlog)", parseSkillOption)
  .action(async (exportFile: string, options: WorklogCommandOptions, command: Command) => {
    const resolvedHarness = options.harness ?? options.executor ?? options.e ?? "opencode";
    await runWorklogCommand(
      {
        exportFilePath: exportFile,
        outputFilePath: options.output,
        prompt: options.prompt,
        harness: resolvedHarness,
        model: options.model,
        skill: options.skill,
      },
      { io, opener },
    );
  });
```

#### D. Add the `WorklogCommandOptions` interface

Add near the other option interfaces (after `ScanCommandOptions`):

```typescript
interface WorklogCommandOptions {
  readonly output?: string;
  readonly prompt?: string;
  readonly harness?: HarnessKind;
  readonly executor?: HarnessKind;
  readonly e?: HarnessKind;
  readonly model?: string;
  readonly skill?: WorklogSkill;
}
```

#### E. Update `formatCliError`

Update the error message that currently reads `"Use only \`git-snitch repo\` or \`git-snitch scan\`"` to also include `worklog`:

```typescript
return "Unknown command. Use `git-snitch repo`, `git-snitch scan`, or `git-snitch worklog`. Run `git-snitch --help` for usage.";
```

### 3.2 `apps/cli/package.json`

**No changes needed** — `commander` is already a dependency, and the new command only uses existing workspace packages (`@git-snitch/core`).

### 3.3 `AGENTS.md` (optional but recommended)

Update the "Monorepo Shape" section or add a note about the worklog command. Not strictly required for functionality.

---

## 4. Command Implementation Details

### 4.1 Command Registration

**Location**: `createProgram()` in `apps/cli/src/index.ts`, after the `scan` command block.

**Pattern**: Follow the existing `repo` and `scan` command patterns exactly:
1. Call `program.command("worklog")`
2. Chain `.description(...)`
3. Chain `.argument(...)` for required positional arg
4. Chain `.option(...)` for each flag
5. Chain `.action(async (...))` with the handler

### 4.2 Option Definitions

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `<exportFile>` (positional) | — | `string` (required) | — | Path to JSON export file |
| `-o, --output <path>` | — | `string` | Derived from input (see §4.6) | Output file path |
| `--prompt <text>` | — | `string` | From `--skill` default | Override the AI prompt |
| `--harness <kind>` | `--executor`, `-e` | `"opencode"\|"pi"\|"codex"` | `"opencode"` | AI harness selection |
| `--model <name>` | — | `string` | Harness default | Override default model |
| `--skill <name>` | — | `"repo-log"\|"work-log"\|"changelog"\|"devlog"` | `"work-log"` (used when no `--prompt`) | Skill template |

**Alias resolution**: `--harness`, `--executor`, and `-e` are treated as aliases. The action handler resolves priority as: first defined wins (the action function uses `options.harness ?? options.executor ?? options.e ?? "opencode"`).

**Commander alias handling**: Since Commander doesn't natively support multiple aliases for the same logical option, the implementation defines three separate options (`--harness`, `--executor`, `-e`) and resolves them in the action handler. This follows the same approach that `--branch` uses (collecting into a shared variable).

### 4.3 Input Handling

1. The `<exportFile>` argument is a required positional argument
2. The file is read using `readFile(exportFilePath, "utf8")`
3. Content is parsed as JSON
4. Parsed value is validated using `isRepoReportData()` or `isScanReportData()` from `@git-snitch/core`
5. If validation fails, a clear error message is thrown: `"Export file ... does not contain valid git-snitch report data. Expected kind 'repo' or 'scan' with valid report structure."`

### 4.4 AI Harness Selection Logic

```
resolveHarness(kind?) → HarnessKind
```

1. If `--harness` / `--executor` / `-e` is provided, validate against `["opencode", "pi", "codex"]`
2. If not provided, default to `"opencode"`
3. Each harness maps to a subprocess command:
   - `"opencode"` → spawns `opencode` CLI
   - `"pi"` → spawns `pi` CLI
   - `"codex"` → spawns `codex` CLI
4. The exact CLI flags for each harness are defined in `HARNESS_DEFINITIONS` in `worklog-harness.ts`
5. Validation happens at two levels:
   - **Commander level**: `parseHarnessOption()` rejects invalid values before the action runs
   - **Runner level**: `resolveHarness()` provides a fallback safety check

### 4.5 Model Override Logic

1. `--model <name>` is optional
2. If provided, it is passed to the harness invocation
3. Each harness adapter incorporates the model into its command arguments
4. If not provided, the harness uses its own default model

### 4.6 Skill Loading Mechanism

1. `--skill <name>` selects a predefined prompt template
2. Skills are defined in `worklog-skills.ts` as `SkillDefinition` objects
3. `resolveSkillPrompt(skill, userPrompt)` resolution order:
   - If `--prompt` is provided → use it directly (skill is ignored)
   - If `--skill` is provided → use the skill's `defaultPrompt`
   - If neither → use `"work-log"` skill's default prompt
4. The resolved prompt is combined with the report data to form the full prompt context

### 4.7 Output File Handling

1. If `--output` is provided → use that path (resolved to absolute)
2. If `--output` is NOT provided → derive from input: `<exportfile-base>-worklog.md` (strip `.json`, append `-worklog.md`)
3. The output file path is **included in the prompt** sent to the AI, with instruction: `"Output file path: <path>"`
4. After the harness completes, check if the output file exists on disk
5. **If the AI wrote the file** → print `"Output written to <path>"`
6. **If the AI did NOT write the file** AND stdout is non-empty → write raw stdout to the output file, print `"Harness did not write output file; wrote raw output to <path>"`
7. **If no output at all** → print warning to stderr

---

## 5. Integration Points

### 5.1 `@git-snitch/core` Integration

- **`isRepoReportData()`** and **`isScanReportData()`** — used to validate the export file content
- **`ReportData` type** — used as the type for parsed export data
- **`repoReportDataSchema`** / **`scanReportDataSchema`** — available for deeper validation if needed
- No new exports needed from `@git-snitch/core`

### 5.2 Commander.js Integration

- New command registered via `program.command("worklog")` in `createProgram()`
- Uses same patterns as `repo` and `scan`: `.argument()`, `.option()`, `.action()`
- Follows the same error handling via `exitOverride()` and `formatCliError()`

### 5.3 Test Infrastructure Integration

- `runCli()` function already accepts `CliDependencies` for injected I/O
- New tests follow `createBufferedOutput()` pattern from existing tests
- Fixture creation helpers (`createFixtureRepo`, etc.) can be reused
- To generate a test export file: run `runCli(["repo", repoPath, "--json"])` → capture stdout → write to temp file → pass to `worklog` command

### 5.4 Harness Spawning

- Uses Node.js `child_process.spawn()` (already imported in `index.ts`)
- Non-blocking, Promise-based via `worklog-harness.ts`
- stdin/stdout/stderr are captured via stream events
- The harness runs as a child process; no in-process AI model loading

---

## 6. Type Definitions Needed

All new types are defined in `apps/cli/src/worklog-types.ts` (see §2.1). Summary:

| Type | Purpose |
|------|---------|
| `HarnessKind` | Union type: `"opencode" \| "pi" \| "codex"` |
| `HarnessConfig` | Config for harness execution: `{ kind, model? }` |
| `HarnessResult` | Subprocess result: `{ stdout, stderr, exitCode }` |
| `HarnessInvocation` | What to send to harness: `{ prompt, inputFile, outputFile, model? }` |
| `WorklogSkill` | Union type: `"repo-log" \| "work-log" \| "changelog" \| "devlog"` |
| `WorklogCommandOptions` | Commander-parsed CLI options |
| `WorklogRunOptions` | Resolved options passed to `runWorklogCommand()` |
| `SkillDefinition` | Skill metadata: `{ name, description, defaultPrompt }` |

---

## 7. Implementation Phases

### Phase 1: Type Definitions and Skill Templates

**Files**: `apps/cli/src/worklog-types.ts`, `apps/cli/src/worklog-skills.ts`

**Steps**:
1. Create `worklog-types.ts` with all type definitions (§2.1)
2. Create `worklog-skills.ts` with skill definitions and `resolveSkillPrompt()` (§2.2)
3. Run `pnpm turbo check-types` to verify types compile

### Phase 2: Harness Adapter

**Files**: `apps/cli/src/worklog-harness.ts`

**Steps**:
1. Create `worklog-harness.ts` with harness definitions and `executeHarness()` (§2.3)
2. Implement subprocess spawning logic with proper error handling
3. Verify each harness definition's CLI flag format against the actual tools
4. Run `pnpm turbo check-types`

### Phase 3: Worklog Runner

**Files**: `apps/cli/src/worklog-runner.ts`

**Steps**:
1. Create `worklog-runner.ts` with `runWorklogCommand()` (§2.4)
2. Implement export file reading and validation
3. Implement prompt context building
4. Implement output file fallback logic
5. Run `pnpm turbo check-types`

### Phase 4: CLI Registration

**Files**: `apps/cli/src/index.ts` (modify)

**Steps**:
1. Add imports for new modules and types (§3.1.A)
2. Add `parseHarnessOption()` and `parseSkillOption()` helpers (§3.1.B)
3. Add `WorklogCommandOptions` interface (§3.1.D)
4. Register the `worklog` command in `createProgram()` (§3.1.C)
5. Update `formatCliError()` to include `worklog` in the message (§3.1.E)
6. Run `pnpm turbo check-types`
7. Run `pnpm turbo build`

### Phase 5: Tests

**Files**: `apps/cli/test/worklog.test.ts` (create)

**Steps**:
1. Create test file following existing patterns from `index.test.ts`
2. Test export file validation (missing file, invalid JSON, non-report JSON, valid repo JSON, valid scan JSON)
3. Test option validation (invalid harness, invalid skill)
4. Test prompt resolution (default skill, explicit skill, user prompt override)
5. Test output file fallback behavior
6. Test help output includes worklog
7. Run `pnpm turbo test` from `apps/cli`

### Phase 6: Verification

**Steps**:
1. Run `pnpm turbo check-types` from repo root
2. Run `pnpm turbo build` from repo root
3. Run `pnpm turbo test` from repo root
4. Manual test: `pnpm -F @git-snitch/cli build && node apps/cli/dist/index.js --help`
5. Verify `worklog` appears in help output
6. Generate a test export: `node apps/cli/dist/index.js repo . --json > /tmp/test-export.json`
7. Test worklog: `node apps/cli/dist/index.js worklog /tmp/test-export.json --prompt "Summarize this" --output /tmp/test-worklog.md`

---

## 8. Architectural Notes

### Design Decisions

1. **New files, not a new package**: The worklog command lives in `@git-snitch/cli` because it's a CLI-only concern. It doesn't add core analysis logic or renderer dependencies. This follows the existing pattern where `repo` and `scan` are also defined in `apps/cli/src/index.ts`.

2. **Subprocess-based harness execution**: The AI harnesses (opencode, pi, codex) are invoked as child processes rather than loaded as libraries. This provides:
   - Clean isolation (no dependency conflicts)
   - Each harness can be installed/updated independently
   - The worklog command doesn't need to know about AI SDK internals

3. **Output file fallback**: The AI is instructed (via prompt) to write to a specific file path. If it doesn't (e.g., the model doesn't support file writes), the raw stdout is captured and written as a fallback. This provides graceful degradation.

4. **Export file as input (not live git analysis)**: The worklog command takes a pre-generated export file rather than running git analysis itself. This separates concerns: `repo`/`scan` commands generate data; `worklog` consumes it. Users can generate exports once and run multiple worklog variations.

5. **Prompt includes full report JSON inline**: The report data is embedded directly in the prompt rather than referenced by path. This ensures the AI model has complete context regardless of how the harness processes file references.

6. **Three option aliases for harness**: `--harness`, `--executor`, and `-e` all map to the same value. Commander doesn't natively support multiple aliases, so three separate options are defined and merged in the action handler.

### What This Does NOT Include

- No new `@git-snitch/core` exports (uses existing type guards and validators)
- No new `@git-snitch/renderer` changes (worklog produces text, not HTML reports)
- No new npm dependencies (commander is already available; `child_process` is built-in)
- No config file integration (worklog options are CLI-only; no `.git-snitch/config.json` entries for worklog in v1)
- No `--json` flag (worklog produces text output, not structured data)

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Harness CLI not installed | Medium | Clear error message when spawn fails; detect and suggest installation |
| Large export files exceed model context | Medium | Validate file size; warn if > threshold; truncate if needed |
| Harness flags differ from assumed format | High | Verify exact CLI interfaces for opencode/pi/codex before implementation |
| AI doesn't write to specified file | Low | Fallback mechanism writes raw stdout to output file |
| Concurrent file writes | Low | Each worklog invocation writes to its own output path |
