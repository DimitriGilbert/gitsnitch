import { spawn } from "node:child_process";

import type { AiHarness, HarnessCallOptions } from "../types.js";

export class CodexHarness implements AiHarness {
  public readonly name = "codex";

  public async generate(prompt: string, options: HarnessCallOptions): Promise<string> {
    const args: string[] = ["exec", prompt];

    if (options.model !== undefined && options.model.length > 0) {
      args.push("-m", options.model);
    }

    return new Promise<string>((resolve, reject) => {
      const child = spawn("codex", args, {
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
            `codex CLI not found: ${error.message}. Install codex or use --harness opencode`,
          ),
        );
      });

      child.on("close", (code) => {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();

        if (code !== 0) {
          const detail = stderr.length > 0 ? `: ${stderr}` : "";
          reject(new Error(`codex CLI exited with code ${code}${detail}`));
          return;
        }

        const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();

        if (stdout.length === 0) {
          reject(new Error("codex CLI returned empty output"));
          return;
        }

        resolve(stdout);
      });
    });
  }
}
