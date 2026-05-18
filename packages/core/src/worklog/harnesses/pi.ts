import type { AiHarness, HarnessCallOptions } from "../types.js";

export class PiHarness implements AiHarness {
  public readonly name = "pi";

  public async generate(_prompt: string, _options: HarnessCallOptions): Promise<string> {
    throw new Error("The pi harness is not yet implemented. Use: opencode");
  }
}
