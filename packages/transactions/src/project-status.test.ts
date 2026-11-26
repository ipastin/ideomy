import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createVaultIdentity, hashRaw } from "@ideomy/vault-io";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  commitProjectStatus,
  type ProjectStatusChange,
  type ProjectStatusJournal,
  recoverProjectStatus,
  type TransactionScope,
} from "./index.ts";

const project = "10 Projects/Build Ideomy v1.md";
const fixture = readFileSync(path.resolve(import.meta.dirname, "../../../fixtures/test-vault", project), "utf8");
const before = Buffer.from(
  `\ufeff${fixture
    .replace("status: active", "workflow_status: active # project workflow")
    .replace("outcome:", "user_details: { owner: synthetic }\noutcome:")
    .replaceAll("\n", "\r\n")}\r\nUser Markdown 🧪 with [[links]].\r\n`,
);
const after = Buffer.from(before.toString("utf8").replace("workflow_status: active", "workflow_status: paused"));
const change: ProjectStatusChange = {
  projectId: "prj_01M4K11NG0XKJFG87XA758PBH3",
  status: "paused",
  expectedHash: hashRaw(before),
};
const childTimeout = 20_000;

let root: string;
let scope: TransactionScope;
let file: string;
let journalDirectory: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "ideomy-project-transaction-"));
  const vaultRoot = path.join(root, "vault");
  const stateDirectory = path.join(root, "state");
  file = path.join(vaultRoot, project);
  mkdirSync(path.dirname(file), { recursive: true });
  mkdirSync(stateDirectory, { mode: 0o700 });
  writeFileSync(file, before);
  const identity = createVaultIdentity(vaultRoot);
  scope = { vaultRoot, vaultId: identity.vault_id, stateDirectory, propertyMapping: { status: "workflow_status" } };
  journalDirectory = path.join(stateDirectory, "transactions", identity.fingerprint);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function pending(): ProjectStatusJournal {
  const active = JSON.parse(readFileSync(path.join(journalDirectory, "active.json"), "utf8")) as { id: string };
  expect(active).toEqual({ id: expect.any(String) });
  return JSON.parse(readFileSync(path.join(journalDirectory, `${active.id}.json`), "utf8")) as ProjectStatusJournal;
}

function runChild(mode: "before" | "after" | "external-edit") {
  return spawnSync(
    process.execPath,
    [
      "--experimental-transform-types",
      "--input-type=module",
      "-e",
      `
        import fs from "node:fs";
        import { syncBuiltinESMExports } from "node:module";
        const [entry, mode, targetFile, scope, change] = process.argv.slice(1);
        const rename = fs.renameSync;
        fs.renameSync = (source, target) => {
          const replacesNote = target.endsWith(".md");
          if (replacesNote && mode === "before") process.kill(process.pid, "SIGKILL");
          rename(source, target);
          if (replacesNote && mode === "after") process.kill(process.pid, "SIGKILL");
        };
        if (mode === "external-edit") {
          const open = fs.openSync;
          fs.openSync = (file, flags, permissions) => {
            const fd = open(file, flags, permissions);
            if (flags === "wx" && String(file).endsWith(".tmp")) {
              fs.appendFileSync(targetFile, "External edit during apply.\\r\\n");
            }
            return fd;
          };
        }
        syncBuiltinESMExports();
        const { commitProjectStatus } = await import(entry);
        commitProjectStatus(JSON.parse(scope), JSON.parse(change));
      `,
      new URL("./index.ts", import.meta.url).href,
      mode,
      file,
      JSON.stringify(scope),
      JSON.stringify(change),
    ],
    { encoding: "utf8", timeout: childTimeout },
  );
}

function interrupt(phase: "before" | "after"): void {
  const run = runChild(phase);
  expect(run.signal, run.stderr).toBe("SIGKILL");
}

it("commits a single mapped scalar, preserving all other Vault bytes, and records the diff", () => {
  const receipt = commitProjectStatus(scope, change);
  expect(readFileSync(file).equals(after)).toBe(true);
  expect(receipt).toMatchObject({
    path: path.normalize(project),
    beforeHash: hashRaw(before),
    afterHash: hashRaw(after),
    projectId: change.projectId,
    previousStatus: "active",
    status: "paused",
    state: "committed",
  });
  expect(readdirSync(journalDirectory)).toEqual([`${receipt.id}.json`]);
  expect(JSON.parse(readFileSync(path.join(journalDirectory, `${receipt.id}.json`), "utf8"))).toEqual(receipt);
  expect(recoverProjectStatus(scope)).toBeNull();
});

it("rejects a stale SHA-256 after an external Markdown edit", () => {
  const external = Buffer.concat([before, Buffer.from("External editor appended this.\r\n")]);
  writeFileSync(file, external);
  expect(hashRaw(external)).not.toBe(change.expectedHash);
  expect(() => commitProjectStatus(scope, change)).toThrowError(expect.objectContaining({ code: "TX-CONFLICT" }));
  expect(readFileSync(file).equals(external)).toBe(true);
  expect(readdirSync(journalDirectory)).toEqual([]);
});

it("rechecks the source hash after staging and preserves an external edit before rename", {
  timeout: childTimeout + 5_000,
}, () => {
  const run = runChild("external-edit");
  expect(run.status, run.stderr).toBe(1);
  expect(run.stderr).toContain("TX-CONFLICT");
  const external = Buffer.concat([before, Buffer.from("External edit during apply.\r\n")]);
  expect(readFileSync(file).equals(external)).toBe(true);
  const [receipt] = readdirSync(journalDirectory);
  expect(JSON.parse(readFileSync(path.join(journalDirectory, receipt ?? ""), "utf8"))).toMatchObject({
    beforeHash: hashRaw(before),
    state: "rolled_back",
  });
  expect(recoverProjectStatus(scope)).toBeNull();
});

it.each(["before", "after"] as const)("recovers a real process interruption %s atomic replacement", {
  timeout: childTimeout + 5_000,
}, (phase) => {
  interrupt(phase);
  const journal = pending();
  expect(journal).toMatchObject({ state: "applying", beforeHash: hashRaw(before), afterHash: hashRaw(after) });
  expect(readFileSync(path.join(journalDirectory, `${journal.id}.snapshot`)).equals(before)).toBe(true);
  expect(readFileSync(file).equals(phase === "before" ? before : after)).toBe(true);
  expect(() => commitProjectStatus(scope, change)).toThrowError(
    expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }),
  );
  expect(recoverProjectStatus(scope)).toMatchObject({ id: journal.id, state: "rolled_back" });
  expect(readFileSync(file).equals(before)).toBe(true);
  expect(readdirSync(path.dirname(file))).toEqual([path.basename(file)]);
  expect(readdirSync(journalDirectory)).toEqual([`${journal.id}.json`]);
  expect(recoverProjectStatus(scope)).toBeNull();
  expect(commitProjectStatus(scope, change).state).toBe("committed");
});

it("leaves an external edit after interruption intact and retains the recovery snapshot", {
  timeout: childTimeout + 5_000,
}, () => {
  interrupt("after");
  const external = Buffer.concat([after, Buffer.from("External editor after interruption.\r\n")]);
  writeFileSync(file, external);
  expect(() => recoverProjectStatus(scope)).toThrowError(expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }));
  expect(readFileSync(file).equals(external)).toBe(true);
  const journal = pending();
  expect(journal.state).toBe("recovery_required");
  expect(readFileSync(path.join(journalDirectory, `${journal.id}.snapshot`)).equals(before)).toBe(true);
  expect(() => commitProjectStatus(scope, { ...change, expectedHash: hashRaw(external) })).toThrowError(
    expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }),
  );
});

it("refuses duplicate managed IDs, including when the target hash matches", () => {
  writeFileSync(path.join(scope.vaultRoot, "Duplicate.md"), before);
  expect(() => commitProjectStatus(scope, change)).toThrowError(expect.objectContaining({ code: "TX-INVALID" }));
  expect(readFileSync(file).equals(before)).toBe(true);
  expect(readdirSync(journalDirectory)).toEqual([]);
});

it("does not follow a recovery target symlink outside the Vault", { timeout: childTimeout + 5_000 }, () => {
  interrupt("after");
  const outside = path.join(root, "outside.md");
  writeFileSync(outside, after);
  rmSync(file);
  symlinkSync(outside, file);
  expect(() => recoverProjectStatus(scope)).toThrowError(expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }));
  expect(readFileSync(outside).equals(after)).toBe(true);
  expect(pending().state).toBe("recovery_required");
});
