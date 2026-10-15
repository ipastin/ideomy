import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CoreProcessRuntime, MacosCoreLifecycle } from "./core-lifecycle.ts";
import { readCoreProfile } from "./core-state.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "ideomy-lifecycle-"));
  chmodSync(directory, 0o700);
  directories.push(directory);
  let live = false;
  const lock = path.join(directory, "core-instance.lock");
  const discovery = path.join(directory, "core-discovery.json");
  const writeState = () => {
    writeFileSync(lock, "12345", { mode: 0o600 });
    writeFileSync(discovery, JSON.stringify({ pid: 12345, protocol: 1, port: 12345, vault_id: "vault_synthetic" }), {
      mode: 0o600,
    });
  };
  const runtime: CoreProcessRuntime = {
    alive: vi.fn(() => live),
    owns: vi.fn(() => true),
    launch: vi.fn(async () => {
      live = true;
      writeState();
    }),
    terminate: vi.fn(() => {
      live = false;
      unlinkSync(lock);
      unlinkSync(discovery);
    }),
  };
  const adapter = new MacosCoreLifecycle({
    entrypoint: "/synthetic/core/main.js",
    stateDirectory: directory,
    runtime,
    platform: "darwin",
  });
  return {
    adapter,
    directory,
    lock,
    discovery,
    runtime,
    writeState,
    setLive(value: boolean) {
      live = value;
    },
  };
}

describe("macOS Alpha Core lifecycle", () => {
  it("starts idempotently, restarts and stops using the same private state", async () => {
    const { adapter, runtime, directory } = fixture();
    expect(adapter.inspect()).toEqual({ state: "stopped" });
    expect(await adapter.start()).toEqual({ state: "running", pid: 12345 });
    await adapter.start();
    expect(runtime.launch).toHaveBeenCalledTimes(1);
    expect(runtime.launch).toHaveBeenCalledWith(
      process.execPath,
      "/synthetic/core/main.js",
      directory,
      expect.any(Number),
    );
    expect(adapter.logs()).toBe("");
    expect(await adapter.restart()).toEqual({ state: "running", pid: 12345 });
    expect(await adapter.stop()).toEqual({ state: "stopped" });
    expect(runtime.launch).toHaveBeenCalledTimes(2);
  });

  it("reports stale locks read-only and requires explicit repair before restart", async () => {
    const { adapter, lock, writeState, runtime } = fixture();
    writeState();
    expect(adapter.inspect()).toEqual({ state: "stale", pid: 12345 });
    expect(existsSync(lock)).toBe(true);
    await expect(adapter.start()).rejects.toThrow("explicit repair");
    expect(runtime.launch).not.toHaveBeenCalled();
    adapter.repairStaleLock();
    expect(existsSync(lock)).toBe(false);
    expect(await adapter.start()).toEqual({ state: "running", pid: 12345 });
  });

  it("never signals or removes a live foreign PID", async () => {
    const { adapter, runtime, writeState, setLive, lock } = fixture();
    writeState();
    setLive(true);
    vi.mocked(runtime.owns).mockReturnValue(false);
    expect(adapter.inspect()).toEqual({ state: "blocked", pid: 12345 });
    await expect(adapter.stop()).rejects.toThrow("unverified");
    expect(() => adapter.repairStaleLock()).toThrow("cannot be removed");
    expect(runtime.terminate).not.toHaveBeenCalled();
    expect(existsSync(lock)).toBe(true);
  });

  it("blocks a live PID when discovery differs or is incomplete", async () => {
    const { adapter, discovery, writeState, setLive, runtime } = fixture();
    writeState();
    setLive(true);
    writeFileSync(discovery, JSON.stringify({ pid: 999, protocol: 1, port: 12345 }));
    expect(adapter.inspect().state).toBe("blocked");
    await expect(adapter.start()).rejects.toThrow("explicit repair");
    expect(runtime.launch).not.toHaveBeenCalled();
  });

  it("rejects malformed locks, public state, and symlinked state files", () => {
    const { adapter, directory, lock, writeState } = fixture();
    writeState();
    writeFileSync(lock, "-12345");
    expect(() => adapter.inspect()).toThrow("invalid");
    unlinkSync(lock);
    symlinkSync(path.join(directory, "core-discovery.json"), lock);
    expect(() => adapter.inspect()).toThrow("not private");
    unlinkSync(lock);
    chmodSync(directory, 0o755);
    expect(() => adapter.inspect()).toThrow("not private");
  });

  it("rejects non-macOS platforms", () => {
    expect(() => new MacosCoreLifecycle({ entrypoint: "/synthetic/core.js", platform: "linux" })).toThrow(
      "unavailable",
    );
  });

  it("rejects symlinked and public logs before launching", async () => {
    const { adapter, directory, runtime } = fixture();
    const log = path.join(directory, "core.log");
    symlinkSync(path.join(directory, "missing-target"), log);
    await expect(adapter.start()).rejects.toThrow();
    expect(existsSync(path.join(directory, "missing-target"))).toBe(false);
    unlinkSync(log);
    writeFileSync(log, "", { mode: 0o644 });
    await expect(adapter.start()).rejects.toThrow("not private");
    expect(runtime.launch).not.toHaveBeenCalled();
  });

  it("does not remove a stale lock when its PID becomes live during repair", () => {
    const { adapter, runtime, writeState, lock } = fixture();
    writeState();
    vi.mocked(runtime.alive).mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(() => adapter.repairStaleLock()).toThrow("changed during repair");
    expect(existsSync(lock)).toBe(true);
  });

  it("propagates launch failure without creating a Core lock", async () => {
    const { adapter, runtime, lock } = fixture();
    vi.mocked(runtime.launch).mockRejectedValue(new Error("synthetic launch failure"));
    await expect(adapter.start()).rejects.toThrow("synthetic launch failure");
    expect(existsSync(lock)).toBe(false);
  });

  it("refreshes existing setup connection metadata when Core starts and restarts", async () => {
    const { adapter, directory } = fixture();
    const vault = path.join(directory, "synthetic-vault");
    const plugin = path.join(vault, ".obsidian/plugins/ideomy");
    mkdirSync(plugin, { recursive: true });
    const profile = { vault_id: "vault_synthetic", vault_fingerprint: "synthetic", vault_path: vault };
    writeFileSync(path.join(directory, "core-profile.json"), JSON.stringify(profile), { mode: 0o600 });
    const target = path.join(plugin, "connection.json");
    writeFileSync(
      target,
      JSON.stringify({
        discovery: { vault_id: "vault_synthetic", port: 999 },
        vaultFingerprint: "synthetic",
        vaultPath: vault,
        custom: "preserved",
      }),
    );
    await adapter.start();
    const refreshed = JSON.parse(readFileSync(target, "utf8"));
    expect(refreshed.discovery.port).toBe(12345);
    expect(refreshed.custom).toBe("preserved");
    await adapter.restart();
    expect(JSON.parse(readFileSync(target, "utf8")).discovery.pid).toBe(12345);
    await adapter.stop();
  });

  it("rejects mismatched or symlinked setup metadata without overwriting it", async () => {
    const { adapter, directory } = fixture();
    const vault = path.join(directory, "synthetic-vault");
    const plugin = path.join(vault, ".obsidian/plugins/ideomy");
    mkdirSync(plugin, { recursive: true });
    writeFileSync(
      path.join(directory, "core-profile.json"),
      JSON.stringify({ vault_id: "vault_synthetic", vault_fingerprint: "synthetic", vault_path: vault }),
      { mode: 0o600 },
    );
    const target = path.join(plugin, "connection.json");
    const raw = JSON.stringify({
      discovery: { vault_id: "vault_foreign" },
      vaultFingerprint: "synthetic",
      vaultPath: vault,
    });
    writeFileSync(target, raw);
    await expect(adapter.start()).rejects.toThrow("identity");
    expect(readFileSync(target, "utf8")).toBe(raw);
    unlinkSync(target);
    symlinkSync(path.join(directory, "missing-connection"), target);
    await expect(adapter.start()).rejects.toThrow("unsafe");
    expect(existsSync(path.join(directory, "missing-connection"))).toBe(false);
    await adapter.stop();
  });

  it("preserves optional Vault profile settings and validates mapping values", () => {
    const { directory } = fixture();
    const profile = {
      vault_id: "vault_synthetic",
      vault_fingerprint: "synthetic",
      vault_path: "/synthetic/vault",
      property_mapping: { title: "name" },
    };
    const target = path.join(directory, "core-profile.json");
    writeFileSync(target, JSON.stringify(profile), { mode: 0o600 });
    expect(readCoreProfile(directory)).toEqual(profile);
    writeFileSync(target, JSON.stringify({ ...profile, property_mapping: { title: 4 } }));
    expect(() => readCoreProfile(directory)).toThrow("invalid");
  });
});
