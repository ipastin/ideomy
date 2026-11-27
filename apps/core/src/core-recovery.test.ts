import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoreClient } from "@ideomy/core-client";
import { MacosCoreLifecycle, readCliAdminSecret } from "@ideomy/platform";
import type { ProjectStatusJournal } from "@ideomy/transactions";
import { createVaultIdentity, deriveVaultFingerprint, hashRaw } from "@ideomy/vault-io";
import { afterEach, beforeEach, expect, it } from "vitest";
import { type CoreOptions, type RunningCore, startCore } from "./index.ts";

const project = "10 Projects/Build Ideomy v1.md";
const source = readFileSync(path.resolve(import.meta.dirname, "../../../fixtures/test-vault", project), "utf8");
const original = Buffer.from(
  `\ufeff${source
    .replace("status: active", "workflow_status: active # user comment")
    .replace("outcome:", "user_details: { owner: synthetic }\noutcome:")
    .replaceAll("\n", "\r\n")}\r\nUser Markdown 🧪 with [[links]].\r\n`,
);
const applied = Buffer.from(original.toString("utf8").replace("workflow_status: active", "workflow_status: paused"));
const change = {
  projectId: "prj_01M4K11NG0XKJFG87XA758PBH3",
  status: "paused",
  expectedHash: hashRaw(original),
};
const childTimeout = 25_000;
const crashTest = { timeout: childTimeout + 5_000 };

let root: string;
let profile: CoreOptions;
let file: string;
let journalDirectory: string;
let lock: string;
let lifecycle: MacosCoreLifecycle;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "ideomy-core-recovery-"));
  const vaultPath = path.join(root, "vault");
  const stateDirectory = path.join(root, "state");
  file = path.join(vaultPath, project);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, original);
  const identity = createVaultIdentity(vaultPath);
  profile = {
    stateDirectory,
    vaultPath,
    vaultId: identity.vault_id,
    vaultFingerprint: identity.fingerprint,
    propertyMapping: { status: "workflow_status" },
  };
  journalDirectory = path.join(stateDirectory, "transactions", identity.fingerprint);
  lock = path.join(stateDirectory, "core-instance.lock");
  lifecycle = new MacosCoreLifecycle({
    stateDirectory,
    entrypoint: fileURLToPath(new URL("./main.ts", import.meta.url)),
    platform: "darwin",
  });
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const stateFile = (name: string) => path.join(journalDirectory, name);
const journal = (id: string) => JSON.parse(readFileSync(stateFile(`${id}.json`), "utf8")) as ProjectStatusJournal;

async function crashAndRepair(phase: "before" | "after") {
  const run = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        const [entry, adapter, profile, change, phase] = process.argv.slice(1);
        const { startCore } = await import(entry);
        const { transactionFs } = await import(adapter);
        const core = await startCore(JSON.parse(profile));
        const exchange = transactionFs.exchange;
        transactionFs.exchange = (file, slot) => {
          if (phase === "after") exchange(file, slot);
          process.kill(process.pid, "SIGKILL");
        };
        core.commitProjectStatus(JSON.parse(change));
      `,
      new URL("./index.ts", import.meta.url).href,
      new URL("../../../packages/transactions/src/posix.ts", import.meta.url).href,
      JSON.stringify(profile),
      JSON.stringify(change),
      phase,
    ],
    { encoding: "utf8", timeout: childTimeout },
  );
  expect(run.signal, run.stderr || run.error?.message).toBe("SIGKILL");
  expect(readFileSync(file)).toEqual(phase === "before" ? original : applied);
  const active = JSON.parse(readFileSync(stateFile("active.json"), "utf8")) as { id: string };
  expect(journal(active.id)).toMatchObject({
    state: "applying",
    beforeHash: change.expectedHash,
    afterHash: hashRaw(applied),
  });
  expect(readFileSync(stateFile(`${active.id}.snapshot`))).toEqual(original);
  expect(readFileSync(lock, "utf8")).toBe(String(run.pid));
  expect(lifecycle.inspect()).toEqual({ state: "stale", pid: run.pid });
  await expect(startCore(profile)).rejects.toThrow("explicitly repair a stale lock");
  expect(journal(active.id).state).toBe("applying");
  lifecycle.repairStaleLock();
  expect(lifecycle.inspect()).toEqual({ state: "stopped" });
  expect(existsSync(stateFile("active.json"))).toBe(true);
  return active.id;
}

async function systemHealth(core: RunningCore) {
  const client = new CoreClient(() => core.discovery);
  await client.connectCli(
    {
      vaultId: profile.vaultId,
      vaultFingerprint: profile.vaultFingerprint,
      clientInstanceId: "cli_recovery",
      clientVersion: "0.0.0",
    },
    readCliAdminSecret(profile.stateDirectory),
  );
  return client.systemHealth();
}

it.each(["before", "after"] as const)("recovers on startup after SIGKILL %s the exchange", crashTest, async (phase) => {
  const id = await crashAndRepair(phase);
  const core = await startCore(profile);
  try {
    expect(readFileSync(file)).toEqual(original);
    expect(journal(id).state).toBe("rolled_back");
    expect(existsSync(stateFile("active.json"))).toBe(false);
    const index = JSON.parse(readFileSync(path.join(profile.stateDirectory, "bootstrap-index.json"), "utf8"));
    expect(index.notes).toContainEqual(expect.objectContaining({ path: project, hash: change.expectedHash }));
    expect(await systemHealth(core)).toMatchObject({ status: "healthy", index: { status: "current" } });

    expect(() => lifecycle.repairStaleLock()).toThrow("live or unverified Core lock");
    expect(readFileSync(lock, "utf8")).toBe(String(process.pid));
    expect(core.commitProjectStatus(change).state).toBe("committed");
    expect(readFileSync(file)).toEqual(applied);
  } finally {
    await core.close();
  }
  expect(existsSync(lock)).toBe(false);
});

it(
  "keeps Core readable and blocks managed writes when crash recovery would overwrite an external edit",
  crashTest,
  async () => {
    const id = await crashAndRepair("after");
    const external = Buffer.concat([applied, Buffer.from("External edit after the crash.\r\n")]);
    writeFileSync(file, external);
    for (const state of ["applying", "recovery_required"]) {
      expect(journal(id).state).toBe(state);
      const core = await startCore(profile);
      try {
        expect(await systemHealth(core)).toMatchObject({
          status: "degraded",
          core: { status: "ready" },
          schema: { status: "valid", diagnostics: ["TX-RECOVERY-REQUIRED"] },
          index: { status: "current" },
        });
        expect(() =>
          core.commitProjectStatus({ ...change, status: "completed", expectedHash: hashRaw(external) }),
        ).toThrowError(expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }));
        expect(journal(id).state).toBe("recovery_required");
        expect(existsSync(stateFile("active.json"))).toBe(true);
        expect(readFileSync(stateFile(`${id}.snapshot`))).toEqual(original);
        expect(readFileSync(file)).toEqual(external);
      } finally {
        await core.close();
      }
    }
  },
);

it("does not recover or write through a Vault path with a different fingerprint", crashTest, async () => {
  const id = await crashAndRepair("after");
  const otherVault = path.join(root, "other-vault");
  mkdirSync(otherVault);
  profile.vaultFingerprint = deriveVaultFingerprint(otherVault, profile.vaultId);
  const core = await startCore(profile);
  try {
    expect(await systemHealth(core)).toMatchObject({ vault: { status: "mismatch" } });
    expect(() => core.commitProjectStatus(change)).toThrowError(expect.objectContaining({ code: "TX-INVALID" }));
    expect(journal(id).state).toBe("applying");
    expect(readFileSync(file)).toEqual(applied);
  } finally {
    await core.close();
  }
});
