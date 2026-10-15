import type { CliDiagnostic } from "@ideomy/contracts";
import { type EnvironmentSnapshot, inspectEnvironment, inspectSetupEnvironment } from "@ideomy/platform";

export {
  doctorFoundation,
  type FoundationDependencies,
  type FoundationOptions,
  repairFoundation,
  setupFoundation,
  statusFoundation,
  uninstallFoundation,
  updateFoundation,
} from "./foundation.ts";

export const bootstrapStages = [
  "START",
  "CHECK_PLATFORM",
  "CHECK_OBSIDIAN",
  "CHECK_OBSIDIAN_CLI",
  "SELECT_MODE",
  "SELECT_OR_CREATE_VAULT",
  "PLAN_MUTATIONS",
  "PREPARE_VAULT",
  "INSTALL_PLUGIN",
  "INSTALL_CORE",
  "WRITE_CONFIG",
  "START_CORE",
  "VERIFY_HANDSHAKE",
  "VALIDATE_VAULT",
  "BUILD_INITIAL_INDEX",
  "RUN_DOCTOR",
  "OPEN_VAULT",
  "DONE",
] as const;

export type BootstrapStage = (typeof bootstrapStages)[number];
export type Diagnostic = CliDiagnostic;
export type ShellResult = {
  ok: boolean;
  status: "healthy" | "degraded" | "failed";
  exitCode: 0 | 2 | 10 | 20 | 30 | 40 | 50 | 70 | 80 | 90;
  data: Record<string, unknown>;
  diagnostics: Diagnostic[];
};

const diagnostic = (
  code: string,
  message: string,
  remediation: string,
  severity: Diagnostic["severity"] = "error",
): Diagnostic => ({
  code,
  severity,
  message,
  remediation,
  repairable: false,
});

export type SetupOptions = {
  mode?: "new" | "existing";
  vault?: string;
  nonInteractive: boolean;
};

export function setupShell(
  options: SetupOptions,
  environment: EnvironmentSnapshot = inspectSetupEnvironment(),
): ShellResult {
  const completed: BootstrapStage[] = ["START"];
  const blocked = (stage: BootstrapStage, exitCode: ShellResult["exitCode"], issue: Diagnostic): ShellResult => ({
    ok: false,
    status: "failed",
    exitCode,
    data: { stage, completed_stages: completed, resumable: true },
    diagnostics: [issue],
  });

  if (
    environment.platform !== "darwin" ||
    !environment.macosVersionSupported ||
    !["arm64", "x64"].includes(environment.architecture)
  ) {
    return blocked(
      "CHECK_PLATFORM",
      10,
      diagnostic(
        "ENV-001",
        "This platform is not supported by the M0 Core setup.",
        "Use macOS 13.5 or later on arm64 or x64.",
      ),
    );
  }
  completed.push("CHECK_PLATFORM");
  if (!environment.obsidianInstalled) {
    return blocked(
      "CHECK_OBSIDIAN",
      10,
      diagnostic("OBS-001", "Obsidian was not found.", "Install Obsidian and rerun ideomy setup."),
    );
  }
  completed.push("CHECK_OBSIDIAN");
  if (!environment.obsidianCliRegistered) {
    return blocked(
      "CHECK_OBSIDIAN_CLI",
      10,
      diagnostic(
        "OBS-002",
        "Obsidian CLI is not registered in PATH.",
        "In Obsidian Settings → General, enable Command line interface, follow its registration prompt, restart the terminal, then rerun ideomy setup.",
      ),
    );
  }
  if (!environment.obsidianCliEnabled) {
    return blocked(
      "CHECK_OBSIDIAN_CLI",
      10,
      diagnostic(
        "OBS-003",
        "Obsidian CLI did not respond to its help command.",
        "Open Obsidian, confirm Command line interface is enabled in Settings → General, run obsidian help, then rerun ideomy setup.",
      ),
    );
  }
  completed.push("CHECK_OBSIDIAN_CLI");
  if (options.nonInteractive && !options.mode) {
    return blocked(
      "SELECT_MODE",
      2,
      diagnostic("CONFIG-001", "Setup mode is required without prompts.", "Pass --new or --existing."),
    );
  }
  if (!options.mode) {
    return blocked(
      "SELECT_MODE",
      2,
      diagnostic(
        "CONFIG-001",
        "Select whether to create or attach a Vault.",
        "Pass --new or --existing; the interactive selector arrives with Vault bootstrap.",
      ),
    );
  }
  completed.push("SELECT_MODE");
  if (!options.vault) {
    return blocked(
      "SELECT_OR_CREATE_VAULT",
      2,
      diagnostic("VAULT-001", "Vault path is required.", "Pass --vault <path>."),
    );
  }
  completed.push("SELECT_OR_CREATE_VAULT");
  return blocked(
    "PLAN_MUTATIONS",
    10,
    diagnostic(
      "DIST-001",
      "Vault mutation planning is not available in the M0.1 shell.",
      "Continue with M0.2 Vault I/O and later Bootstrap slices; no Vault files were changed.",
    ),
  );
}

export function statusShell(environment: EnvironmentSnapshot = inspectEnvironment()): ShellResult {
  return {
    ok: true,
    status: "degraded",
    exitCode: 0,
    data: {
      environment: {
        platform: environment.platform,
        architecture: environment.architecture,
        supported: environment.macosVersionSupported,
      },
      obsidian: {
        installed: environment.obsidianInstalled,
        cli_registered: environment.obsidianCliRegistered,
        cli_enabled: "unknown",
      },
      vault: { status: "unavailable" },
      plugin: { status: "unavailable" },
      core: { status: "unavailable" },
      schema: { status: "unavailable" },
      index: { status: "unavailable" },
    },
    diagnostics: [
      diagnostic(
        "DIST-001",
        "Bootstrap components cannot yet be inspected by the M0.1 shell.",
        "Complete the Vault, Core and Plugin implementation slices.",
        "warning",
      ),
    ],
  };
}

export function doctorShell(environment: EnvironmentSnapshot = inspectEnvironment()): ShellResult {
  const result = statusShell(environment);
  return {
    ...result,
    ok: false,
    status: "failed",
    exitCode:
      !environment.macosVersionSupported || !environment.obsidianInstalled || !environment.obsidianCliRegistered
        ? 10
        : 20,
    data: {
      ...result.data,
      checks: [
        { layer: "Environment", status: environment.macosVersionSupported ? "pass" : "fail" },
        {
          layer: "Obsidian / CLI",
          status: environment.obsidianInstalled && environment.obsidianCliRegistered ? "unverified" : "fail",
        },
        ...[
          "Plugin",
          "Core",
          "Vault permissions",
          "Vault configuration",
          "Schema",
          "Index",
          "Plugin↔Core contract compatibility",
          "Core↔Vault identity",
          "Model Gateway configuration",
        ].map((layer) => ({
          layer,
          status: "unavailable",
        })),
      ],
    },
    diagnostics: [
      ...(!environment.macosVersionSupported
        ? [
            diagnostic(
              "ENV-001",
              "This platform is not supported by the M0 Core setup.",
              "Use macOS 13.5 or later on arm64 or x64.",
            ),
          ]
        : []),
      ...(!environment.obsidianInstalled
        ? [diagnostic("OBS-001", "Obsidian was not found.", "Install Obsidian and rerun ideomy doctor.")]
        : []),
      ...(!environment.obsidianCliRegistered
        ? [
            diagnostic(
              "OBS-002",
              "Obsidian CLI is not registered in PATH.",
              "Enable it in Obsidian Settings → General and restart the terminal.",
            ),
          ]
        : []),
      ...result.diagnostics.map((issue) => ({ ...issue, severity: "error" as const })),
    ],
  };
}
