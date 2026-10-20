import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CoreClient } from "@ideomy/core-client";
import { BetterSqliteStore, indexFilename } from "@ideomy/index";
import { readCliAdminSecret } from "@ideomy/platform";
import { deriveVaultFingerprint } from "@ideomy/vault-io";
import { expect, it } from "vitest";
import { startCore } from "./index.ts";
import { inspectVault, synchronizeVaultIndex } from "./vault-health.ts";

const person = `---
ideomy_schema: 1
id: per_01ARZ3NDEKTSV4RRFFQ69G5FAV
type: person
status: active
created: 2026-10-15T12:00:00Z
updated: 2026-10-15T12:00:00Z
sensitivity: private
agent_access: local_only
---
# Synthetic Person
`;

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "ideomy-index-"));
  const vaultPath = path.join(directory, "vault");
  const stateDirectory = path.join(directory, "state");
  mkdirSync(vaultPath);
  mkdirSync(stateDirectory, { mode: 0o700 });
  mkdirSync(path.join(vaultPath, ".obsidian/plugins/ideomy"), { recursive: true });
  writeFileSync(path.join(vaultPath, "person.md"), person);
  writeFileSync(path.join(vaultPath, "unmanaged.md"), "# Synthetic unmanaged\r\nuser content\r\n");
  const profile = {
    stateDirectory,
    vaultPath,
    vaultId: "synthetic",
    vaultFingerprint: deriveVaultFingerprint(vaultPath, "synthetic"),
  };
  return { directory, profile };
}

async function waitForIndex(client: CoreClient, expected: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const health = await client.systemHealth();
    if ((health.index as { status?: string }).status === expected) return health;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Index did not reach ${expected}.`);
}

async function waitForSearch(databasePath: string, query: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const store = new BetterSqliteStore(databasePath);
    try {
      if (store.search(query).length) return;
    } finally {
      store.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Index did not include ${query}.`);
}

async function waitForPaths(databasePath: string, query: string, expected: string[]) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const store = new BetterSqliteStore(databasePath);
    try {
      if (JSON.stringify(store.search(query).map((hit) => hit.path)) === JSON.stringify(expected)) return;
    } finally {
      store.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Index did not reconcile ${query}.`);
}

async function waitForLocalIndex(profile: Parameters<typeof inspectVault>[0], expected: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (inspectVault(profile).index === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Index did not reach ${expected}.`);
}

it("indexes on startup, reports external changes and missing cache, and rebuilds on restart without rewriting notes", async () => {
  const { directory, profile } = fixture();
  let core = await startCore(profile);
  try {
    const client = new CoreClient(() => core.discovery);
    const identity = {
      vaultId: profile.vaultId,
      vaultFingerprint: profile.vaultFingerprint,
      clientInstanceId: "cli_index",
      clientVersion: "0.0.0",
    };
    const handshake = await client.connectCli(identity, readCliAdminSecret(profile.stateDirectory));
    expect(handshake.compatibility).toBe("compatible");
    expect(await waitForIndex(client, "current")).toMatchObject({ status: "healthy", index: { status: "current" } });
    writeFileSync(path.join(profile.vaultPath, ".obsidian/plugins/ideomy/connection.json"), "{}");
    expect(inspectVault(profile).index).toBe("current");
    const cache = path.join(profile.stateDirectory, "bootstrap-index.json");
    expect(JSON.parse(readFileSync(cache, "utf8")).notes).toEqual([
      expect.objectContaining({ path: "person.md", kind: "managed", type: "person" }),
      expect.objectContaining({ path: "unmanaged.md", kind: "unmanaged" }),
    ]);
    expect(readFileSync(cache, "utf8")).not.toContain("Synthetic Person");
    expect(JSON.parse(readFileSync(cache, "utf8")).postings).toMatchObject({
      synthetic: ["person.md", "unmanaged.md"],
      person: ["person.md"],
      content: ["unmanaged.md"],
    });
    expect(readFileSync(cache, "utf8")).not.toContain("user content");
    writeFileSync(path.join(profile.vaultPath, "unmanaged.md"), "# Synthetic changed\r\n");
    await waitForSearch(path.join(profile.stateDirectory, indexFilename), "changed");
    expect(await waitForIndex(client, "current")).toMatchObject({ status: "healthy", index: { status: "current" } });
    unlinkSync(cache);
    expect(inspectVault(profile).index).toBe("missing");
    await waitForLocalIndex(profile, "current");
    unlinkSync(path.join(profile.stateDirectory, indexFilename));
    expect(inspectVault(profile).index).toBe("missing");
    await waitForLocalIndex(profile, "current");
    await core.close();
    core = await startCore(profile);
    expect(inspectVault(profile)).toMatchObject({ schema: "valid", index: "current" });
    const rebuiltPostings = JSON.parse(readFileSync(cache, "utf8")).postings;
    expect(rebuiltPostings.changed).toEqual(["unmanaged.md"]);
    expect(rebuiltPostings.content).toBeUndefined();
    expect(readFileSync(path.join(profile.vaultPath, "person.md"), "utf8")).toBe(person);
    expect(readFileSync(path.join(profile.vaultPath, "unmanaged.md"), "utf8")).toBe("# Synthetic changed\r\n");
    renameSync(path.join(profile.vaultPath, "person.md"), path.join(profile.vaultPath, "renamed.md"));
    await waitForPaths(path.join(profile.stateDirectory, indexFilename), "person", ["renamed.md"]);
    unlinkSync(path.join(profile.vaultPath, "unmanaged.md"));
    await waitForPaths(path.join(profile.stateDirectory, indexFilename), "changed", []);
    await waitForLocalIndex(profile, "current");
    expect(readFileSync(path.join(profile.vaultPath, "renamed.md"), "utf8")).toBe(person);
  } finally {
    await core.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);

it("blocks validity for duplicate IDs, malformed YAML, invalid mapping and wrong Vault identity", async () => {
  const { directory, profile } = fixture();
  try {
    writeFileSync(path.join(profile.vaultPath, "duplicate.md"), person);
    const core = await startCore(profile);
    try {
      expect(inspectVault(profile)).toMatchObject({ schema: "invalid", index: "invalid", diagnostics: ["SCHEMA-104"] });
    } finally {
      await core.close();
    }
    unlinkSync(path.join(profile.vaultPath, "duplicate.md"));
    writeFileSync(path.join(profile.vaultPath, "invalid.md"), "---\nkey: first\nkey: second\n---\n");
    expect(inspectVault(profile)).toMatchObject({ schema: "invalid", diagnostics: ["VAULT-104"] });
    unlinkSync(path.join(profile.vaultPath, "invalid.md"));
    expect(inspectVault({ ...profile, propertyMapping: { status: "type" } })).toMatchObject({ schema: "invalid" });
    expect(inspectVault({ ...profile, vaultFingerprint: "other" })).toMatchObject({
      vault: "mismatch",
      index: "invalid",
    });
    rmSync(profile.vaultPath, { recursive: true });
    expect(inspectVault(profile)).toMatchObject({ vault: "unavailable", index: "unavailable" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("reports an invalid SQLite cache and rebuilds after cache removal", () => {
  const { directory, profile } = fixture();
  try {
    expect(synchronizeVaultIndex(profile).index).toBe("current");
    const databasePath = path.join(profile.stateDirectory, indexFilename);
    writeFileSync(databasePath, "not a SQLite database");
    expect(inspectVault(profile).index).toBe("invalid");
    expect(synchronizeVaultIndex(profile).index).toBe("invalid");
    unlinkSync(databasePath);
    expect(synchronizeVaultIndex(profile).index).toBe("current");
    expect(readFileSync(path.join(profile.vaultPath, "person.md"), "utf8")).toBe(person);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
