import type { AiHarness, WorklogHarness } from "../types.js";

import { CodexHarness } from "./codex.js";
import { OpencodeHarness } from "./opencode.js";
import { PiHarness } from "./pi.js";

const harnessFactories: Readonly<Record<WorklogHarness, () => AiHarness>> = {
  opencode: () => new OpencodeHarness(),
  pi: () => new PiHarness(),
  codex: () => new CodexHarness(),
};

export function createHarness(name: WorklogHarness): AiHarness {
  const factory = harnessFactories[name];
  return factory();
}
