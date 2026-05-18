import { spawn } from "node:child_process";

import type { AiHarness, HarnessCallOptions } from "../types.js";

export class PiHarness implements AiHarness {
  public readonly name = "pi";

  public async generate(prompt: string, options: HarnessCallOptions): Promise<string> {
    const args: string[] = ["--prompt", prompt, "--non-interactive"];

    if (options.model !== undefined && options.model.length > 0) {
      args.push("--model", options.model);
    }

    return new Promise<string>((resolve, reject) => {
      const child = spawn("pi", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on("error", (error: Error) => {
        reject(
          new Error(
            `Failed to spawn pi CLI: ${error.message}. Install pi or use --harness opencode`,
          ),
        );
      });

      child.on("close", (code) => {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

        if (code !== 0) {
          const detail = stderr.length > 0 ? `: ${stderr}` : "";
          reject(new Error(`pi CLI exited with code ${code}${detail}`));
          return;
        }

        const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();

        if (stdout.length === 0) {
          reject(new Error("pi CLI returned empty output"));
          return;
        }

        resolve(stdout);
      });
    });
  }
}
