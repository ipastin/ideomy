import { lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function coreStateDirectory(): string {
  if (process.env.IDEOMY_STATE_DIR) return path.resolve(process.env.IDEOMY_STATE_DIR);
  if (process.platform === "darwin") return path.join(homedir(), "Library", "Application Support", "Ideomy", "Core");
  if (process.platform === "win32") return path.join(process.env.APPDATA ?? homedir(), "Ideomy", "Core");
  return path.join(process.env.XDG_STATE_HOME ?? path.join(homedir(), ".local", "state"), "ideomy");
}

export function readMachineLocalFile(directory: string, name: string): string {
  const container = lstatSync(directory);
  if (!container.isDirectory() || (process.platform !== "win32" && (container.mode & 0o077) !== 0)) {
    throw new Error("Core state directory is not private.");
  }
  const target = path.join(directory, name);
  const state = lstatSync(target);
  if (!state.isFile() || (process.platform !== "win32" && (state.mode & 0o077) !== 0)) {
    throw new Error("Core state file is not private.");
  }
  return readFileSync(target, "utf8");
}

export function readCoreDiscovery(directory = coreStateDirectory()): unknown {
  return JSON.parse(readMachineLocalFile(directory, "core-discovery.json"));
}

export function readCliAdminSecret(directory = coreStateDirectory()): string {
  const secret = readMachineLocalFile(directory, "core-admin.secret").trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error("Core admin state is invalid.");
  return secret;
}

export interface CoreProfile {
  vault_id: string;
  vault_fingerprint: string;
  vault_path?: string;
  property_mapping?: Record<string, string>;
}

export function readCoreProfile(directory = coreStateDirectory()): CoreProfile {
  const value: unknown = JSON.parse(readMachineLocalFile(directory, "core-profile.json"));
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as Record<string, unknown>).vault_id !== "string" ||
    typeof (value as Record<string, unknown>).vault_fingerprint !== "string"
  ) {
    throw new Error("Core profile is invalid.");
  }
  const profile = value as Record<string, unknown>;
  if (
    (profile.vault_path !== undefined && typeof profile.vault_path !== "string") ||
    (profile.property_mapping !== undefined &&
      (!profile.property_mapping ||
        typeof profile.property_mapping !== "object" ||
        Array.isArray(profile.property_mapping) ||
        Object.values(profile.property_mapping).some((entry) => typeof entry !== "string")))
  )
    throw new Error("Core profile is invalid.");
  return value as CoreProfile;
}
