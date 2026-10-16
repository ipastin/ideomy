import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CLI_VERSION, parseArgs, promptForSetup, setupPromptFailure } from "./index.js";

const cli = new URL("./index.ts", import.meta.url);
const invoke = (...args: string[]) => spawnSync(process.execPath, [cli.pathname, ...args], { encoding: "utf8" });

describe("M0.1 CLI contract", () => {
  it("has a working executable, help and version", () => {
    expect(invoke("--help").stdout).toContain("setup       Begin guided setup");
    expect(invoke("--version").stdout.trim()).toBe(CLI_VERSION);
  });

  it("uses one clean versioned JSON document and stable usage exit", () => {
    const status = invoke("status", "--json");
    expect(status.status).toBe(0);
    const output = JSON.parse(status.stdout);
    expect(output).toMatchObject({
      schema_version: "1",
      command: "status",
      status: "degraded",
      meta: { cli_version: CLI_VERSION },
    });
    expect(status.stdout.trim().split("\n")).toHaveLength(1);
    expect(status.stderr).toBe("");

    const bad = invoke("setup", "--unknown", "--json");
    expect(bad.status).toBe(2);
    expect(JSON.parse(bad.stdout).diagnostics[0].code).toBe("CONFIG-002");
    expect(bad.stderr).toBe("");
  });

  it("rejects conflicting modes and does not prompt in non-interactive mode", () => {
    expect(parseArgs(["setup", "--new", "--existing"]).error).toContain("mutually exclusive");
    const result = invoke("setup", "--non-interactive", "--json");
    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout).ok).toBe(false);
  });

  it("prompts for a missing interactive mode and Vault path without changing explicit choices", async () => {
    const questions: string[] = [];
    const answers = ["existing", "/synthetic/existing-vault"];
    const selected = await promptForSetup({}, async (message) => {
      questions.push(message);
      return answers.shift() ?? "";
    });
    expect(selected).toEqual({ mode: "existing", vault: "/synthetic/existing-vault" });
    expect(questions).toEqual([
      "Create a new Vault or attach an existing one? [new/existing] ",
      "Absolute Vault path: ",
    ]);
    const newAnswers = ["new", "/synthetic/new-vault"];
    expect(await promptForSetup({}, async () => newAnswers.shift() ?? "")).toEqual({
      mode: "new",
      vault: "/synthetic/new-vault",
    });
    expect(
      await promptForSetup({ mode: "new", vault: "/synthetic/new-vault" }, async () => {
        throw new Error("Unexpected prompt");
      }),
    ).toEqual({ mode: "new", vault: "/synthetic/new-vault" });
    await expect(promptForSetup({}, async () => "invalid")).rejects.toThrow("Choose new or existing.");
    await expect(promptForSetup({ mode: "new" }, async () => "")).rejects.toThrow("Enter an absolute Vault path.");
  });

  it("maps interrupted interactive input to the conventional exit code", () => {
    const interrupted = new Error("Aborted with Ctrl+C");
    interrupted.name = "AbortError";
    expect(setupPromptFailure(interrupted)).toBe(130);
    expect(setupPromptFailure(new Error("Choose new or existing."))).toMatchObject({
      exitCode: 2,
      diagnostics: [{ code: "CONFIG-002" }],
    });
  });
});
