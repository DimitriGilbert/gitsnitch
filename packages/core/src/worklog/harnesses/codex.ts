import type { AiHarness, HarnessCallOptions } from "../types.js";

export class CodexHarness implements AiHarness {
  public readonly name = "codex";

  public async generate(_prompt: string, _options: HarnessCallOptions): Promise<string> {
    throw new Error("The codex harness is not yet implemented. Use: opencode");
  }
}
