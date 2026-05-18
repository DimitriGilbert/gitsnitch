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
