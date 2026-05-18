import type { AiHarness, WorklogHarness } from "../types.js";

import { OpencodeHarness } from "./opencode.js";

const harnessFactories: Readonly<Record<WorklogHarness, () => AiHarness>> = {
  opencode: () => new OpencodeHarness(),
};

export function createHarness(name: WorklogHarness): AiHarness {
  const factory = harnessFactories[name];
  return factory();
}
