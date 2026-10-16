import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CoreClient } from "@ideomy/core-client";
import { type CoreProcessState, CoreStartupPendingError } from "@ideomy/platform";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  doctorFoundation,
  type FoundationDependencies,
  repairFoundation,
  setupFoundation,
  statusFoundation,
  uninstallFoundation,
  updateFoundation,
} from "./foundation.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(vaultName = "Vault", registeredName = "Synthetic") {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), "ideomy-bootstrap-"));
  roots.push(root);
  const vault = path.join(root, vaultName);
  const stateDirectory = path.join(root, "state");
  const pluginDirectory = path.join(root, "bundle");
  mkdirSync(pluginDirectory);
  writeFileSync(path.join(pluginDirectory, "manifest.json"), JSON.stringify({ id: "ideomy", version: "0.0.1" }));
  writeFileSync(path.join(pluginDirectory, "main.js"), "// synthetic plugin artifact");
  const coreEntrypoint = path.join(root, "core.ts");
  writeFileSync(coreEntrypoint, "// synthetic Core artifact");
  const templateDirectory = path.join(root, "template");
  mkdirSync(templateDirectory);
  writeFileSync(path.join(templateDirectory, "starter.txt"), "synthetic starter");
  let registered = true;
  let duplicateRegisteredName = false;
  let enabled = false;
  let restricted = false;
  let alreadyDisabled = false;
  let paired = true;
  let index = "current";
  const runObsidian = vi.fn((args: string[]) => {
    if (args[0] === "vaults")
      return {
        ok: true,
        output: registered
          ? `${registeredName}\t${vault}\n${duplicateRegisteredName ? `${registeredName}\t${path.join(root, "another-vault")}\n` : ""}`
          : "",
      };
    if (args[0] !== `vault=${registeredName}`) return { ok: false, output: "Vault not found." };
    if (args[1] === "plugins:restrict") return { ok: true, output: restricted ? "on" : "off" };
    if (args[1] === "plugin:enable" && restricted) return { ok: false, output: "Restricted mode is on." };
    if (args[1] === "plugin:disable" && alreadyDisabled)
      return { ok: false, output: 'Error: Plugin "ideomy" is already disabled.' };
    if (args[1] === "plugin:enable") enabled = true;
    if (args[1] === "plugin:disable") enabled = false;
    return { ok: true, output: args[1] === "plugins:enabled" && enabled ? "ideomy\t0.0.1\n" : "" };
  });
  const openVault = vi.fn(() => ({ ok: true, output: "" }));
  const lifecycle = {
    inspect: vi.fn((): CoreProcessState => ({ state: "running", pid: 123 })),
    start: vi.fn(async () => {
      writeFileSync(path.join(stateDirectory, "core-admin.secret"), "A".repeat(43), { mode: 0o600 });
      const profile = JSON.parse(readFileSync(path.join(stateDirectory, "core-profile.json"), "utf8"));
      writeFileSync(path.join(stateDirectory, "core-discovery.json"), JSON.stringify({ vault_id: profile.vault_id }), {
        mode: 0o600,
      });
      return { state: "running" as const, pid: 123 };
    }),
    stop: vi.fn(async () => ({ state: "stopped" as const })),
    restart: vi.fn(async () => {
      index = "current";
      return { state: "running" as const, pid: 123 };
    }),
  };
  const client = {
    connectCli: vi.fn(async () => ({})),
    systemHealth: vi.fn(async () => ({
      status: index === "current" ? "healthy" : "degraded",
      core: { plugin_paired: paired, plugin_authenticated: paired, plugin_handshake: paired },
      vault: { status: "bound" },
      schema: { status: "valid" },
      index: { status: index },
    })),
    openPairingWindow: vi.fn(async () => ({ bootstrap_proof: "ephemeral-proof" })),
  };
  const dependencies: FoundationDependencies = {
    stateDirectory,
    pluginDirectory,
    coreEntrypoint,
    templateDirectory,
    runObsidian,
    openVault,
    lifecycle,
    client: client as unknown as CoreClient,
    environment: {
      platform: "darwin",
      architecture: "arm64",
      macosVersionSupported: true,
      obsidianInstalled: true,
      obsidianCliRegistered: true,
      obsidianCliEnabled: true,
    },
  };
  return {
    vault,
    pluginDirectory,
    dependencies,
    lifecycle,
    client,
    runObsidian,
    openVault,
    stateDirectory,
    setRegistered: (value: boolean) => {
      registered = value;
    },
    setDuplicateRegisteredName: (value: boolean) => {
      duplicateRegisteredName = value;
    },
    setRestricted: (value: boolean) => {
      restricted = value;
    },
    setAlreadyDisabled: (value: boolean) => {
      alreadyDisabled = value;
    },
    setPaired: (value: boolean) => {
      paired = value;
    },
    setIndex: (value: string) => {
      index = value;
    },
  };
}
const options = { mode: "new" as const, nonInteractive: true, yes: true, skipOpen: true, channel: "dev" };

describe("Bootstrap Foundation", () => {
  it("opens the registered Vault with the Obsidian URI after doctor passes", async () => {
    const f = fixture("Vault", "Synthetic Vault");
    const result = await setupFoundation({ ...options, vault: f.vault, skipOpen: false }, f.dependencies);
    expect(result.data.stage).toBe("DONE");
    expect(f.openVault).toHaveBeenCalledExactlyOnceWith("obsidian://open?vault=Synthetic%20Vault");
    expect(f.runObsidian).not.toHaveBeenCalledWith(["vault=Synthetic Vault", "open"]);
  });
  it("resumes OPEN_VAULT when the URI launch fails without repeating Vault writes", async () => {
    const f = fixture();
    f.openVault.mockReturnValueOnce({ ok: false, output: "synthetic launch failure" });
    expect((await setupFoundation({ ...options, vault: f.vault, skipOpen: false }, f.dependencies)).data.stage).toBe(
      "OPEN_VAULT",
    );
    writeFileSync(path.join(f.vault, "user.md"), "keep");
    expect((await setupFoundation({ ...options, vault: f.vault, skipOpen: false }, f.dependencies)).data.stage).toBe(
      "DONE",
    );
    expect(readFileSync(path.join(f.vault, "user.md"), "utf8")).toBe("keep");
  });
  it("verifies the development Core runtime closure beyond its unchanged entrypoint", async () => {
    const f = fixture();
    const workspace = path.join(path.dirname(f.vault), "runtime");
    for (const name of [
      "apps/core",
      "packages/contracts",
      "packages/platform",
      "packages/schema",
      "packages/vault-io",
    ]) {
      const directory = path.join(workspace, name);
      mkdirSync(path.join(directory, "src"), { recursive: true });
      writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name }));
      writeFileSync(path.join(directory, "src/index.ts"), "export const synthetic = true;\n");
    }
    writeFileSync(path.join(workspace, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    const entrypoint = path.join(workspace, "apps/core/src/main.ts");
    const entry = "import './index.ts';\n";
    writeFileSync(entrypoint, entry);
    f.dependencies.coreEntrypoint = entrypoint;
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
    expect((await doctorFoundation(f.dependencies)).ok).toBe(true);
    const imported = path.join(workspace, "packages/platform/src/index.ts");
    writeFileSync(imported, "export const synthetic = false;\n");
    expect(readFileSync(entrypoint, "utf8")).toBe(entry);
    expect((await doctorFoundation(f.dependencies)).diagnostics[0]?.code).toBe("CORE-002");
    const stateBeforeRetry = readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"));
    const startsBeforeRetry = f.lifecycle.start.mock.calls.length;
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).diagnostics[0]?.code).toBe(
      "CORE-002",
    );
    expect(readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"))).toEqual(stateBeforeRetry);
    expect(f.lifecycle.start.mock.calls).toHaveLength(startsBeforeRetry);
    expect((await repairFoundation({ yes: true }, f.dependencies)).diagnostics[0]?.code).toBe("CORE-002");
    writeFileSync(imported, "export const synthetic = true;\n");
    expect((await doctorFoundation(f.dependencies)).ok).toBe(true);
    writeFileSync(path.join(workspace, "pnpm-lock.yaml"), "lockfileVersion: 'changed'\n");
    expect((await doctorFoundation(f.dependencies)).diagnostics[0]?.code).toBe("CORE-002");
  });
  it("creates a synthetic Vault and reruns without changing identity or user files", async () => {
    const f = fixture();
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).data.stage).toBe("DONE");
    const profile = readFileSync(path.join(f.stateDirectory, "core-profile.json"));
    writeFileSync(path.join(f.vault, "user.md"), "unmanaged user note\r\n");
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
    expect(readFileSync(path.join(f.stateDirectory, "core-profile.json"))).toEqual(profile);
    expect(readFileSync(path.join(f.vault, "user.md"), "utf8")).toBe("unmanaged user note\r\n");
  });
  it("attaches without rewriting existing Markdown or imposing starter folders", async () => {
    const f = fixture();
    mkdirSync(f.vault);
    const original = Buffer.from("---\r\ncustom: value # preserved\r\n---\r\n# Original\r\n");
    writeFileSync(path.join(f.vault, "existing.md"), original);
    expect((await setupFoundation({ ...options, mode: "existing", vault: f.vault }, f.dependencies)).ok).toBe(true);
    expect(readFileSync(path.join(f.vault, "existing.md"))).toEqual(original);
    expect(readdirSync(f.vault).sort()).toEqual([".obsidian", "existing.md"]);
  });
  it("previews before creating anything and refuses non-empty new Vault paths", async () => {
    const f = fixture();
    expect(
      (await setupFoundation({ ...options, yes: false, vault: f.vault }, f.dependencies)).data.confirmation_required,
    ).toBe(true);
    expect(readdirSync(path.dirname(f.vault))).not.toContain("Vault");
    mkdirSync(f.vault);
    writeFileSync(path.join(f.vault, "user.md"), "keep");
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).diagnostics[0]?.code).toBe(
      "VAULT-001",
    );
  });
  it("resumes after supported Obsidian Vault registration prerequisite", async () => {
    const f = fixture();
    f.setRegistered(false);
    const result = await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    expect(result.data.stage).toBe("INSTALL_PLUGIN");
    expect(result.diagnostics[0]?.code).toBe("OBS-004");
    f.setRegistered(true);
    expect(
      (await setupFoundation({ nonInteractive: true, yes: true, skipOpen: true, channel: "dev" }, f.dependencies)).ok,
    ).toBe(true);
  });
  it("refuses ambiguous Obsidian Vault names before sending a Vault-scoped command", async () => {
    const f = fixture();
    f.setDuplicateRegisteredName(true);
    const result = await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    expect(result.diagnostics[0]?.code).toBe("OBS-004");
    expect(f.runObsidian.mock.calls.every(([args]) => args[0] === "vaults")).toBe(true);
  });
  it("reloads the Vault before enabling a newly installed Plugin and diagnoses Restricted mode", async () => {
    const f = fixture();
    f.setRestricted(true);
    const blocked = await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    expect(blocked.diagnostics[0]?.code).toBe("PLUG-003");
    expect(blocked.diagnostics[0]?.message).toContain("restricted");
    expect(f.runObsidian).not.toHaveBeenCalledWith(["vault=Synthetic", "plugin:enable", "id=ideomy"]);
    f.setRestricted(false);
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
    const reload = f.runObsidian.mock.calls.findIndex(([args]) => args[1] === "reload");
    const enable = f.runObsidian.mock.calls.findIndex(([args]) => args[1] === "plugin:enable");
    expect(reload).toBeGreaterThan(-1);
    expect(reload).toBeLessThan(enable);
  });
  it("resumes after Core start interruption without rewriting the Vault", async () => {
    const f = fixture();
    f.lifecycle.start.mockRejectedValueOnce(new Error("synthetic interruption"));
    const interrupted = await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    expect(interrupted.data.stage).toBe("START_CORE");
    expect(interrupted.diagnostics[0]?.code).toBe("CORE-503");
    expect(interrupted.diagnostics[0]?.remediation).toContain("Rerun setup");
    writeFileSync(path.join(f.vault, "user.md"), "keep");
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
    expect(readFileSync(path.join(f.vault, "user.md"), "utf8")).toBe("keep");
  });
  it("reports a live Core still indexing as degraded and resumes setup after discovery", async () => {
    const f = fixture();
    f.lifecycle.start.mockRejectedValueOnce(new CoreStartupPendingError());
    const pending = await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    expect(pending.status).toBe("degraded");
    expect(pending.data.stage).toBe("START_CORE");
    expect(pending.data.resumable).toBe(true);
    expect(pending.diagnostics[0]?.code).toBe("CORE-503");
    writeFileSync(path.join(f.vault, "user.md"), "keep");
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).data.stage).toBe("DONE");
    expect(readFileSync(path.join(f.vault, "user.md"), "utf8")).toBe("keep");
  });
  it("requires genuine Plugin handshake and never persists or JSON-prints pairing proof", async () => {
    const f = fixture();
    f.setPaired(false);
    const result = await setupFoundation({ ...options, vault: f.vault, json: true }, f.dependencies);
    expect(result.data.pairing_required).toBe(true);
    expect(JSON.stringify(result)).not.toContain("ephemeral-proof");
    expect(readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"), "utf8")).not.toContain("ephemeral-proof");
    expect((await doctorFoundation(f.dependencies)).ok).toBe(false);
    f.setPaired(true);
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
  });
  it("doctor and status do not repair stale index and setup retries it", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    f.setIndex("stale");
    const before = readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"));
    expect((await doctorFoundation(f.dependencies)).ok).toBe(false);
    expect((await statusFoundation(f.dependencies)).status).toBe("degraded");
    expect(readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"))).toEqual(before);
    expect(f.lifecycle.restart).not.toHaveBeenCalled();
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
    expect(f.lifecycle.restart).toHaveBeenCalledOnce();
  });
  it("shows a narrow index repair plan before confirmation and validates after applying it", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    writeFileSync(path.join(f.vault, "user.md"), "synthetic user content");
    f.setIndex("stale");
    const stateBefore = readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"));
    const preview = await repairFoundation({}, f.dependencies);
    expect(preview.data.plan).toEqual({
      vault_path: f.vault,
      actions: ["rebuild_index"],
      vault_preserved: true,
    });
    expect(preview.data.confirmation_required).toBe(true);
    expect(f.lifecycle.restart).not.toHaveBeenCalled();
    expect(readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"))).toEqual(stateBefore);
    let shownPlan: unknown;
    const applied = await repairFoundation(
      {
        yes: true,
        onPlan: (plan) => {
          shownPlan = plan;
          expect(f.lifecycle.restart).not.toHaveBeenCalled();
        },
      },
      f.dependencies,
    );
    expect(applied.ok).toBe(true);
    expect(shownPlan).toEqual(preview.data.plan);
    expect(applied.data.actions_applied).toEqual(["rebuild_index"]);
    expect(f.lifecycle.restart).toHaveBeenCalledOnce();
    expect(readFileSync(path.join(f.vault, "user.md"), "utf8")).toBe("synthetic user content");
  });
  it("diagnoses a stopped Core and plans only its restart", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    f.lifecycle.inspect.mockReturnValue({ state: "stopped" });
    f.client.connectCli.mockRejectedValueOnce(new Error("synthetic discovery missing"));
    expect((await doctorFoundation(f.dependencies)).diagnostics[0]?.code).toBe("CORE-503");
    f.client.connectCli.mockRejectedValueOnce(new Error("synthetic discovery missing"));
    const preview = await repairFoundation({}, f.dependencies);
    expect(preview.data.plan).toEqual({ vault_path: f.vault, actions: ["start_core"], vault_preserved: true });
    expect(f.lifecycle.start).toHaveBeenCalledTimes(1); // Initial setup only.
    f.client.connectCli.mockRejectedValueOnce(new Error("synthetic discovery missing"));
    const repaired = await repairFoundation({ yes: true }, f.dependencies);
    expect(repaired.ok).toBe(true);
    expect(repaired.data.actions_applied).toEqual(["start_core"]);
    expect(f.lifecycle.start).toHaveBeenCalledTimes(2);
  });
  it("waits for the Plugin to reconnect after an index repair restarts Core", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    f.setIndex("stale");
    f.lifecycle.restart.mockImplementationOnce(async () => {
      f.setIndex("current");
      f.setPaired(false);
      setTimeout(() => f.setPaired(true), 20);
      return { state: "running" as const, pid: 123 };
    });
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
    expect(f.client.systemHealth.mock.calls.length).toBeGreaterThan(2);
  });
  it("waits for a previously paired Plugin after a stopped Core resumes", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    const health = f.client.systemHealth.getMockImplementation();
    if (!health) throw new Error("Synthetic health implementation is missing.");
    let reconnected = false;
    f.client.systemHealth.mockImplementation(async () => {
      const current = await health();
      return {
        ...current,
        core: { plugin_paired: true, plugin_authenticated: reconnected, plugin_handshake: reconnected },
      };
    });
    setTimeout(() => {
      reconnected = true;
    }, 20);
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
    expect(f.client.openPairingWindow).not.toHaveBeenCalled();
  });
  it("waits for the Plugin to reconnect before reporting a completed narrow repair", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    f.setIndex("stale");
    f.lifecycle.restart.mockImplementationOnce(async () => {
      f.setIndex("current");
      f.setPaired(false);
      setTimeout(() => f.setPaired(true), 20);
      return { state: "running" as const, pid: 123 };
    });
    const repaired = await repairFoundation({ yes: true }, f.dependencies);
    expect(repaired.ok).toBe(true);
    expect(repaired.data.actions_applied).toEqual(["rebuild_index"]);
    expect(f.client.systemHealth.mock.calls.length).toBeGreaterThan(2);
  });
  it("refuses read-only Vaults before installing and refuses profile mismatches", async () => {
    const f = fixture();
    mkdirSync(f.vault);
    chmodSync(f.vault, 0o500);
    expect(
      (await setupFoundation({ ...options, mode: "existing", vault: f.vault }, f.dependencies)).diagnostics[0]?.code,
    ).toBe("VAULT-002");
    chmodSync(f.vault, 0o700);
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    const profileFile = path.join(f.stateDirectory, "core-profile.json");
    const profile = JSON.parse(readFileSync(profileFile, "utf8"));
    profile.vault_fingerprint = "wrong";
    writeFileSync(profileFile, JSON.stringify(profile));
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).diagnostics[0]?.code).toBe(
      "VAULT-004",
    );
  });
  it("refuses incompatible Plugin version and uninstalls without deleting Vault notes", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    const manifest = path.join(f.vault, ".obsidian/plugins/ideomy/manifest.json");
    const previous = readFileSync(manifest);
    writeFileSync(manifest, JSON.stringify({ id: "ideomy", version: "9.0.0" }));
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).diagnostics[0]?.code).toBe(
      "PLUG-002",
    );
    writeFileSync(manifest, previous);
    writeFileSync(path.join(f.vault, "user.md"), "retained");
    writeFileSync(path.join(f.stateDirectory, "core.log"), "synthetic log", { mode: 0o600 });
    expect((await uninstallFoundation(f.dependencies)).data.vault_preserved).toBe(true);
    expect(existsSync(path.join(f.stateDirectory, "core.log"))).toBe(false);
    expect(readFileSync(path.join(f.vault, "user.md"), "utf8")).toBe("retained");
    expect((await uninstallFoundation(f.dependencies)).data.already_uninstalled).toBe(true);
  });
  it("keeps skipped indexing incomplete until an ordinary setup verifies it", async () => {
    const f = fixture();
    expect((await setupFoundation({ ...options, vault: f.vault, skipIndex: true }, f.dependencies)).ok).toBe(false);
    expect((await doctorFoundation(f.dependencies)).ok).toBe(false);
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).ok).toBe(true);
  });
  it("preserves modified Plugin artifacts during uninstall", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    const main = path.join(f.vault, ".obsidian/plugins/ideomy/main.js");
    writeFileSync(main, "user modification");
    expect((await doctorFoundation(f.dependencies)).diagnostics[0]?.code).toBe("PLUG-002");
    expect((await uninstallFoundation(f.dependencies)).ok).toBe(false);
    expect(readFileSync(main, "utf8")).toBe("user modification");
  });
  it("retries uninstall when the Plugin was already disabled by an earlier attempt", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    f.setAlreadyDisabled(true);
    expect((await uninstallFoundation(f.dependencies)).ok).toBe(true);
    expect(existsSync(path.join(f.vault, ".obsidian/plugins/ideomy/main.js"))).toBe(false);
  });
  it("does not replace the Plugin baseline when a candidate bundle changes", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    const stateFile = path.join(f.stateDirectory, "bootstrap-state.json");
    const stateBefore = readFileSync(stateFile);
    writeFileSync(path.join(f.pluginDirectory, "main.js"), "// changed candidate bundle");
    expect((await setupFoundation({ ...options, vault: f.vault }, f.dependencies)).diagnostics[0]?.code).toBe(
      "PLUG-002",
    );
    expect(readFileSync(stateFile)).toEqual(stateBefore);
    expect((await doctorFoundation(f.dependencies)).ok).toBe(true);
    expect((await uninstallFoundation(f.dependencies)).ok).toBe(true);
  });
  it("checks development updates without mutating installed artifacts or the Vault", async () => {
    const f = fixture("My Vault's Notes");
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    const installed = path.join(f.vault, ".obsidian/plugins/ideomy/main.js");
    const before = readFileSync(installed);
    const state = readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"));
    writeFileSync(path.join(f.pluginDirectory, "main.js"), "// candidate revision");
    const check = await updateFoundation({ channel: "dev", check: true }, f.dependencies);
    expect(check.data.changes).toContain("plugin");
    expect(check.exitCode).toBe(0);
    expect(readFileSync(installed)).toEqual(before);
    expect(readFileSync(path.join(f.stateDirectory, "bootstrap-state.json"))).toEqual(state);
    const planned = await updateFoundation({ channel: "dev" }, f.dependencies);
    expect(planned.exitCode).toBe(80);
    expect(planned.diagnostics[0]?.remediation).toContain(`--vault '${f.vault.replaceAll("'", "'\\''")}'`);
  });
  it("retains recovery state after an interrupted uninstall and safely retries missing components", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    writeFileSync(path.join(f.vault, "user.md"), "retained");
    const index = path.join(f.stateDirectory, "bootstrap-index.json");
    mkdirSync(index); // A deterministic unlink failure after Core profile deletion.
    const state = path.join(f.stateDirectory, "bootstrap-state.json");
    expect((await uninstallFoundation(f.dependencies)).ok).toBe(false);
    expect(existsSync(path.join(f.stateDirectory, "core-profile.json"))).toBe(false);
    expect(existsSync(path.join(f.vault, ".obsidian/plugins/ideomy/manifest.json"))).toBe(false);
    expect(existsSync(state)).toBe(true);
    rmSync(index, { recursive: true });
    f.runObsidian.mockImplementation(() => ({ ok: false, output: "Plugin is already removed." }));
    expect((await uninstallFoundation(f.dependencies)).ok).toBe(true);
    expect(existsSync(state)).toBe(false);
    expect(existsSync(path.join(f.stateDirectory, "core-admin.secret"))).toBe(false);
    expect(existsSync(path.join(f.stateDirectory, "core-discovery.json"))).toBe(false);
    expect(existsSync(path.join(f.stateDirectory, "core.log"))).toBe(false);
    expect(readFileSync(path.join(f.vault, "user.md"), "utf8")).toBe("retained");
    expect((await uninstallFoundation(f.dependencies)).data.already_uninstalled).toBe(true);
  });
  it("does not claim another explicitly selected Vault is healthy", async () => {
    const f = fixture();
    await setupFoundation({ ...options, vault: f.vault }, f.dependencies);
    const other = path.join(path.dirname(f.vault), "Other");
    mkdirSync(other);
    expect((await doctorFoundation({ ...f.dependencies, vault: other })).diagnostics[0]?.code).toBe("VAULT-004");
  });
});
