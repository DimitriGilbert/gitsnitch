import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/index";

function createBufferedOutput() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: {
      stdout: (text: string) => out.push(text),
      stderr: (text: string) => err.push(text),
    },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

async function createTempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "git-snitch-worklog-"));
}

describe("worklog command", () => {
  it("rejects missing export file", async () => {
    const output = createBufferedOutput();
    const code = await runCli(["worklog", "nonexistent.json"], { io: output.io });

    expect(code).toBe(1);
    expect(output.stderr()).toContain("Unable to read export file");
  });

  it("rejects invalid JSON", async () => {
    const workspace = await createTempDirectory();
    const badJsonPath = join(workspace, "bad.json");
    await writeFile(badJsonPath, "not json at all", "utf8");

    const output = createBufferedOutput();
    const code = await runCli(["worklog", badJsonPath], { io: output.io });

    expect(code).toBe(1);
    expect(output.stderr()).toContain("valid JSON");
  });

  it("rejects valid JSON that is not report data", async () => {
    const workspace = await createTempDirectory();
    const emptyJsonPath = join(workspace, "empty.json");
    await writeFile(emptyJsonPath, "{}", "utf8");

    const output = createBufferedOutput();
    const code = await runCli(["worklog", emptyJsonPath], { io: output.io });

    expect(code).toBe(1);
    expect(output.stderr()).toContain("valid git-snitch report data");
  });

  it("rejects invalid harness option", async () => {
    const workspace = await createTempDirectory();
    const jsonPath = join(workspace, "data.json");
    await writeFile(jsonPath, "{}", "utf8");

    const output = createBufferedOutput();
    const code = await runCli(["worklog", jsonPath, "--harness", "invalid"], { io: output.io });

    expect(code).toBe(1);
    expect(output.stderr()).toContain("Expected one of: opencode, pi, codex");
  });

  it("rejects invalid skill option", async () => {
    const workspace = await createTempDirectory();
    const jsonPath = join(workspace, "data.json");
    await writeFile(jsonPath, "{}", "utf8");

    const output = createBufferedOutput();
    const code = await runCli(["worklog", jsonPath, "--skill", "invalid"], { io: output.io });

    expect(code).toBe(1);
    expect(output.stderr()).toContain("Expected one of: repo-log, work-log, changelog, devlog");
  });

  it("lists worklog in help output", async () => {
    const output = createBufferedOutput();
    const code = await runCli(["--help"], { io: output.io });

    expect(code).toBe(0);
    expect(output.stdout()).toContain("worklog");
  });
});
