import type { EnvironmentSnapshot } from "@ideomy/platform";
import { describe, expect, it } from "vitest";
import { bootstrapStages, doctorShell, setupShell, statusShell } from "./index.js";

const ready: EnvironmentSnapshot = {
  platform: "darwin",
  architecture: "arm64",
  macosVersionSupported: true,
  obsidianInstalled: true,
  obsidianCliRegistered: true,
  obsidianCliEnabled: true,
};

describe("M0.1 Bootstrap shell", () => {
  it("keeps the canonical stage order and stops before Vault mutation", () => {
    expect(bootstrapStages.slice(0, 7)).toEqual([
      "START",
      "CHECK_PLATFORM",
      "CHECK_OBSIDIAN",
      "CHECK_OBSIDIAN_CLI",
      "SELECT_MODE",
      "SELECT_OR_CREATE_VAULT",
      "PLAN_MUTATIONS",
    ]);
    const options = { mode: "new" as const, vault: "/synthetic/ideomy", nonInteractive: true };
    expect(setupShell(options, ready)).toEqual(setupShell(options, ready));
    const result = setupShell(options, ready);
    expect(result.data.stage).toBe("PLAN_MUTATIONS");
    expect(result.diagnostics[0]?.code).toBe("DIST-001");
    expect(result.ok).toBe(false);
  });

  it("reports prerequisite and non-interactive failures with stable exit classes", () => {
    expect(setupShell({ nonInteractive: true }, { ...ready, obsidianCliRegistered: false }).exitCode).toBe(10);
    expect(setupShell({ nonInteractive: true }, { ...ready, obsidianCliEnabled: false }).diagnostics[0]?.code).toBe(
      "OBS-003",
    );
    const missingMode = setupShell({ nonInteractive: true }, ready);
    expect(missingMode.exitCode).toBe(2);
    expect(missingMode.data.stage).toBe("SELECT_MODE");
  });

  it("never marks unimplemented components healthy", () => {
    const status = statusShell(ready);
    expect(status.status).toBe("degraded");
    expect((status.data.core as { status: string }).status).toBe("unavailable");
    const doctor = doctorShell(ready);
    expect(doctor.ok).toBe(false);
    expect(doctor.exitCode).toBe(20);
  });

  it("reports unsupported macOS architectures consistently across setup, status and doctor", () => {
    const unsupported = { ...ready, architecture: "riscv64" };
    expect(
      setupShell({ mode: "new", vault: "/synthetic/ideomy", nonInteractive: true }, unsupported).diagnostics[0]?.code,
    ).toBe("ENV-001");
    expect((statusShell(unsupported).data.environment as { supported: boolean }).supported).toBe(false);
    const doctor = doctorShell(unsupported);
    expect(doctor.exitCode).toBe(10);
    expect((doctor.data.checks as { layer: string; status: string }[])[0]).toEqual({
      layer: "Environment",
      status: "fail",
    });
    expect(doctor.diagnostics[0]?.code).toBe("ENV-001");
    expect((statusShell({ ...ready, architecture: "x64" }).data.environment as { supported: boolean }).supported).toBe(
      true,
    );
  });

  it("diagnoses a registered but disabled Obsidian CLI without claiming it is enabled", () => {
    const disabled = { ...ready, obsidianCliEnabled: false };
    expect((statusShell(disabled).data.obsidian as { cli_enabled: string }).cli_enabled).toBe("unknown");
    const doctor = doctorShell(disabled);
    expect(doctor.exitCode).toBe(10);
    expect((doctor.data.obsidian as { cli_enabled: boolean }).cli_enabled).toBe(false);
    expect((doctor.data.checks as { layer: string; status: string }[])[1]).toEqual({
      layer: "Obsidian / CLI",
      status: "fail",
    });
    expect(doctor.diagnostics.map((issue) => issue.code)).toContain("OBS-003");
  });
});
