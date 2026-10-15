import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { homedir, release } from "node:os";
import { delimiter, join } from "node:path";

export {
  type CoreProcessRuntime,
  type CoreProcessState,
  CoreStartupPendingError,
  MacosCoreLifecycle,
} from "./core-lifecycle.ts";
export type { CoreProfile } from "./core-state.ts";

export {
  coreStateDirectory,
  readCliAdminSecret,
  readCoreDiscovery,
  readCoreProfile,
  readMachineLocalFile,
} from "./core-state.ts";

export interface EnvironmentSnapshot {
  platform: NodeJS.Platform;
  architecture: string;
  macosVersionSupported: boolean;
  obsidianInstalled: boolean;
  obsidianCliRegistered: boolean;
  obsidianCliEnabled?: boolean;
}

function executableOnPath(name: string): boolean {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    try {
      accessSync(join(directory, name), constants.X_OK);
      return true;
    } catch {
      // Continue through PATH.
    }
  }
  return false;
}

export function inspectEnvironment(): EnvironmentSnapshot {
  const obsidianCliRegistered = executableOnPath("obsidian");
  const [darwinMajor, darwinMinor] = release().split(".").map(Number);
  return {
    platform: process.platform,
    architecture: process.arch,
    // macOS 13.5 corresponds to Darwin 22.6; later Darwin releases also qualify.
    macosVersionSupported:
      process.platform === "darwin" && (darwinMajor ?? 0) >= 22 && ((darwinMajor ?? 0) > 22 || (darwinMinor ?? 0) >= 6),
    obsidianInstalled:
      obsidianCliRegistered ||
      existsSync("/Applications/Obsidian.app") ||
      existsSync(join(homedir(), "Applications/Obsidian.app")),
    // Registration is a read-only signal; setup performs the active check separately.
    obsidianCliRegistered,
  };
}

export function inspectSetupEnvironment(): EnvironmentSnapshot {
  const environment = inspectEnvironment();
  if (!environment.obsidianCliRegistered) return { ...environment, obsidianCliEnabled: false };
  const check = spawnSync("obsidian", ["help"], { stdio: "ignore", timeout: 15_000 });
  return { ...environment, obsidianCliEnabled: check.status === 0 };
}
