import type { ReportData } from "../report-data.js";

import type { WorklogSkillName } from "./types.js";

export interface SkillDefinition {
  readonly name: WorklogSkillName;
  readonly description: string;
  readonly defaultPrompt: string;
}

const SKILLS: readonly SkillDefinition[] = [
  {
    name: "repo-log",
    description: "Generate a structured repository activity log",
    defaultPrompt: `Generate a structured repository activity log from the provided report data.

Cover the following areas:
- Major milestones and release points
- Significant changes and architectural shifts
- Contributor patterns and ownership areas
- Temporal activity patterns and development cadence
- Notable file hotspots and areas of concentrated change

Output clean Markdown with clear headings and sections.`,
  },
  {
    name: "work-log",
    description: "Generate a work log summarizing individual and team contributions",
    defaultPrompt: `Generate a work log summarizing individual and team contributions from the provided report data.

Organize the output as follows:
- Group by contributor, then by time period
- Summarize commit activity with concise descriptions
- Include effort metrics (additions, deletions, files changed)
- Highlight cross-contributor collaboration patterns
- Note any unusual spikes or lulls in activity

Output clean Markdown with clear headings and sections.`,
  },
  {
    name: "changelog",
    description: "Generate a changelog following Keep a Changelog format",
    defaultPrompt: `Generate a changelog from the provided report data following the Keep a Changelog format.

Categorize changes into these sections as applicable:
- Added: new features and capabilities
- Changed: modifications to existing behavior
- Deprecated: features marked for future removal
- Removed: deleted features or capabilities
- Fixed: bug fixes and corrections
- Security: vulnerability fixes and security improvements

Derive categories from commit classifications and messages. Output clean Markdown.`,
  },
  {
    name: "devlog",
    description: "Generate a developer journal / devlog narrative",
    defaultPrompt: `Generate a developer journal / devlog narrative from the provided report data.

Tell the story of development through commits:
- Trace the narrative arc of the project over time
- Highlight key decisions and their rationale (from commit messages)
- Identify turning points and pivotal commits
- Capture the rhythm of development (sprints, pauses, bursts)
- Weave contributor activities into a cohesive narrative

Write in an engaging, readable style. Output clean Markdown.`,
  },
] as const satisfies readonly SkillDefinition[];

export function getSkillDefinitions(): readonly SkillDefinition[] {
  return SKILLS;
}

const DEFAULT_SKILL: WorklogSkillName = "work-log";

export function resolveSkillPrompt(skill: WorklogSkillName | undefined, userPrompt: string | undefined): string {
  if (userPrompt !== undefined && userPrompt.trim().length > 0) {
    return userPrompt.trim();
  }

  const resolvedSkill = skill ?? DEFAULT_SKILL;
  const definition = SKILLS.find((s) => s.name === resolvedSkill);

  return definition?.defaultPrompt ?? SKILLS.find((s) => s.name === DEFAULT_SKILL)!.defaultPrompt;
}

export function buildWorklogPrompt(report: ReportData, customPrompt?: string, skill?: WorklogSkillName): string {
  const resolvedPrompt = resolveSkillPrompt(skill, customPrompt);
  const reportJson = JSON.stringify(report, null, 2);

  return `${resolvedPrompt}

---

Report data:

\`\`\`json
${reportJson}
\`\`\``;
}
