import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { coreStateDirectory, readCoreDiscovery, readCoreProfile, readMachineLocalFile } from "./core-state.ts";

export type CoreProcessState =
  | { state: "stopped" }
  | { state: "stale"; pid: number }
  | { state: "blocked"; pid: number }
  | { state: "running"; pid: number };

export interface CoreProcessRuntime {
  alive(pid: number): boolean;
  owns(pid: number, executable: string, entrypoint: string): boolean;
  launch(executable: string, entrypoint: string, stateDirectory: string, log: number): Promise<void>;
  terminate(pid: number): void;
}

const runtime: CoreProcessRuntime = {
  alive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
      throw error;
    }
  },
  owns(pid, executable, entrypoint) {
    const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "uid=", "-o", "command="], {
      encoding: "utf8",
      timeout: 2000,
    });
    const identity = /^\s*(\d+)\s+(.+?)\s*$/.exec(result.stdout);
    return (
      result.status === 0 &&
      identity?.[1] === String(process.getuid?.()) &&
      identity[2] === `${executable} ${entrypoint}`
    );
  },
  async launch(executable, entrypoint, stateDirectory, log) {
    const child = spawn(executable, [entrypoint], {
      detached: true,
      env: { ...process.env, IDEOMY_STATE_DIR: stateDirectory },
      stdio: ["ignore", log, log],
    });
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("spawn", resolve);
    });
    child.unref();
  },
  terminate(pid) {
    process.kill(pid, "SIGTERM");
  },
};

// Alpha uses a user process; launch-on-login requires the later signed distribution adapter.
export class MacosCoreLifecycle {
  readonly stateDirectory: string;
  readonly entrypoint: string;
  readonly executable: string;
  private readonly runtime: CoreProcessRuntime;

  constructor(options: {
    entrypoint: string;
    stateDirectory?: string;
    executable?: string;
    runtime?: CoreProcessRuntime;
    platform?: NodeJS.Platform;
  }) {
    if ((options.platform ?? process.platform) !== "darwin") throw new Error("macOS Core lifecycle is unavailable.");
    this.stateDirectory = path.resolve(options.stateDirectory ?? coreStateDirectory());
    this.entrypoint = path.resolve(options.entrypoint);
    this.executable = path.resolve(options.executable ?? process.execPath);
    this.runtime = options.runtime ?? runtime;
  }

  inspect(): CoreProcessState {
    if (!existsSync(this.stateDirectory)) return { state: "stopped" };
    this.checkDirectory();
    if (!existsSync(path.join(this.stateDirectory, "core-instance.lock"))) return { state: "stopped" };
    const raw = readMachineLocalFile(this.stateDirectory, "core-instance.lock");
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error("Core lock is invalid.");
    const pid = Number(raw);
    if (!this.runtime.alive(pid)) return { state: "stale", pid };
    if (!this.runtime.owns(pid, this.executable, this.entrypoint)) return { state: "blocked", pid };
    try {
      const discovery = readCoreDiscovery(this.stateDirectory) as Record<string, unknown>;
      if (
        discovery.pid === pid &&
        discovery.protocol === 1 &&
        typeof discovery.port === "number" &&
        Number.isInteger(discovery.port) &&
        discovery.port > 0 &&
        discovery.port <= 65535
      ) {
        return { state: "running", pid };
      }
    } catch {
      // A live process without completed discovery is never safe to replace.
    }
    return { state: "blocked", pid };
  }

  async start(): Promise<CoreProcessState> {
    const current = this.inspect();
    if (current.state === "running") {
      this.refreshPluginConnection();
      return current;
    }
    if (current.state !== "stopped") throw new Error("Core state requires explicit repair before starting.");
    mkdirSync(this.stateDirectory, { recursive: true, mode: 0o700 });
    this.checkDirectory();
    const logPath = path.join(this.stateDirectory, "core.log");
    const log = openSync(
      logPath,
      constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      const state = fstatSync(log);
      if (!state.isFile() || (state.mode & 0o077) !== 0) throw new Error("Core log is not private.");
      await this.runtime.launch(this.executable, this.entrypoint, this.stateDirectory, log);
    } finally {
      closeSync(log);
    }
    // Core validates and indexes the Vault before publishing discovery.
    for (let attempt = 0; attempt < 2400; attempt++) {
      const state = this.inspect();
      if (state.state === "running") {
        this.refreshPluginConnection();
        return state;
      }
      if (state.state === "stale") break;
      if (state.state === "stopped" && attempt >= 100)
        throw new Error("Core exited before publishing discovery; inspect machine-local Core logs.");
      await delay(50);
    }
    throw new Error(
      "Core did not become ready within two minutes; inspect machine-local Core logs and rerun setup after indexing completes.",
    );
  }

  async stop(): Promise<CoreProcessState> {
    const current = this.inspect();
    if (current.state === "stopped") return current;
    if (current.state !== "running")
      throw new Error("Core process identity is unverified; explicit repair is required.");
    this.runtime.terminate(current.pid);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (!this.runtime.alive(current.pid)) return this.inspect();
      await delay(50);
    }
    throw new Error("Core did not stop; the process was not forcibly killed.");
  }

  async restart(): Promise<CoreProcessState> {
    const stopped = await this.stop();
    if (stopped.state === "stale") this.repairStaleLock();
    return this.start();
  }

  repairStaleLock(): void {
    const current = this.inspect();
    if (current.state === "stopped") return;
    if (current.state !== "stale") throw new Error("A live or unverified Core lock cannot be removed.");
    const raw = readMachineLocalFile(this.stateDirectory, "core-instance.lock");
    if (raw !== String(current.pid) || this.runtime.alive(current.pid))
      throw new Error("Core lock changed during repair.");
    unlinkSync(path.join(this.stateDirectory, "core-instance.lock"));
  }

  logs(): string {
    return readMachineLocalFile(this.stateDirectory, "core.log");
  }

  private refreshPluginConnection(): void {
    if (!existsSync(path.join(this.stateDirectory, "core-profile.json"))) return;
    const profile = readCoreProfile(this.stateDirectory);
    if (!profile.vault_path) return;
    let directory = path.resolve(profile.vault_path);
    for (const part of ["", ".obsidian", "plugins", "ideomy"]) {
      directory = path.join(directory, part);
      try {
        if (!lstatSync(directory).isDirectory()) throw new Error("Plugin connection directory is unsafe.");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    }
    const target = path.join(directory, "connection.json");
    try {
      if (!lstatSync(target).isFile()) throw new Error("Plugin connection file is unsafe.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    const raw = readFileSync(target, "utf8");
    const metadata = JSON.parse(raw) as Record<string, unknown>;
    const previous = metadata.discovery as Record<string, unknown> | undefined;
    const discovery = readCoreDiscovery(this.stateDirectory) as Record<string, unknown>;
    if (
      metadata.vaultPath !== profile.vault_path ||
      metadata.vaultFingerprint !== profile.vault_fingerprint ||
      previous?.vault_id !== profile.vault_id ||
      discovery.vault_id !== profile.vault_id
    ) {
      throw new Error("Plugin connection identity does not match the Core profile.");
    }
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify({ ...metadata, discovery }), { mode: 0o600, flag: "wx" });
      if (!lstatSync(target).isFile() || readFileSync(target, "utf8") !== raw) {
        throw new Error("Plugin connection changed during refresh.");
      }
      renameSync(temporary, target);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }

  private checkDirectory(): void {
    const state = lstatSync(this.stateDirectory);
    if (!state.isDirectory() || (state.mode & 0o077) !== 0) throw new Error("Core state directory is not private.");
  }
}
