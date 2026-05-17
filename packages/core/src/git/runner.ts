import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { AsyncCommandRunner, CommandFailure } from "./types";

const execFileAsync = promisify(execFile);

class GitCommandError extends Error implements CommandFailure {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;

  constructor(message: string, details: { readonly stdout?: string; readonly stderr?: string; readonly exitCode?: number }) {
    super(message);
    this.name = "GitCommandError";
    this.stdout = details.stdout;
    this.stderr = details.stderr;
    this.exitCode = details.exitCode;
  }
}

interface ExecFileFailureShape {
  readonly stdout?: unknown;
  readonly stderr?: unknown;
  readonly code?: unknown;
  readonly message?: unknown;
}

function isFailureShape(value: unknown): value is ExecFileFailureShape {
  return typeof value === "object" && value !== null;
}

function stringifyOutput(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numericExitCode(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export const createGitCommandRunner = (): AsyncCommandRunner => async (command, args, options) => {
  try {
    const result = await execFileAsync(command, [...args], {
      cwd: options.cwd,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 20,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    if (isFailureShape(error)) {
      throw new GitCommandError(typeof error.message === "string" ? error.message : `Failed to run ${command} ${args.join(" ")}`, {
        stdout: stringifyOutput(error.stdout),
        stderr: stringifyOutput(error.stderr),
        exitCode: numericExitCode(error.code),
      });
    }
    throw new GitCommandError(`Failed to run ${command} ${args.join(" ")}`, {});
  }
};
