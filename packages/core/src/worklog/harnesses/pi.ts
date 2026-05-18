import { spawn } from "node:child_process";

import type { AiHarness, HarnessCallOptions } from "../types.js";

export class PiHarness implements AiHarness {
  public readonly name = "pi";

  public async generate(prompt: string, options: HarnessCallOptions): Promise<string> {
    const args: string[] = [];

    if (options.model !== undefined && options.model.length > 0) {
      args.push("--model", options.model);
    }

    return new Promise<string>((resolve, reject) => {
      const child = spawn("pi", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      const timeoutMs = options.timeout ?? 120_000;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error(`pi CLI timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on("error", (error: Error) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(
          new Error(
            `pi CLI not found: ${error.message}. Install pi or use --harness opencode`,
          ),
        );
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
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

      child.stdin.on("error", () => {});
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
