import type { ReportData } from "../report-data.js";

import type { WorklogOptions, WorklogResult } from "./types.js";

import { createHarness } from "./harnesses/index.js";
import { buildWorklogPrompt } from "./prompts.js";

export async function generateWorklog(report: ReportData, options: WorklogOptions): Promise<WorklogResult> {
  const harness = createHarness(options.harness);
  const prompt = buildWorklogPrompt(report, options.prompt);

  const markdown = await harness.generate(prompt, {
    model: options.model,
    skill: options.skill,
  });

  return {
    markdown,
    harness: options.harness,
    model: options.model ?? "default",
    generatedAt: new Date().toISOString(),
  };
}

export { createHarness } from "./harnesses/index.js";
export { buildWorklogPrompt, getSkillDefinitions, resolveSkillPrompt } from "./prompts.js";
export { renderWorklogHtml } from "./render.js";
export type { AiHarness, HarnessCallOptions, WorklogHarness, WorklogOptions, WorklogResult, WorklogSkillName } from "./types.js";
export { WORKLOG_HARNESSES } from "./types.js";
