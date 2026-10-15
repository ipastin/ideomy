import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CLI_VERSION, parseArgs } from "./index.js";

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
});
