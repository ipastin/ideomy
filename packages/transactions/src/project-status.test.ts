import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
const childTimeout = 25_000;

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

function runChild(
  mode:
    | "before"
    | "after"
    | "external-edit"
    | "live-writer"
    | "apply-race"
    | "recovery-race"
    | "second-race"
    | "recovery-after"
    | "compensation-crash"
    | "open-editor",
  editorFd?: number,
) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-transform-types",
      "--input-type=module",
      "-e",
      `
        import fs from "node:fs";
        import path from "node:path";
        import { spawnSync } from "node:child_process";
        import { syncBuiltinESMExports } from "node:module";
        const [entry, platform, mode, targetFile, scope, change] = process.argv.slice(1);
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
        if (mode === "open-editor") {
          const remove = fs.rmSync;
          fs.rmSync = (file, options) => {
            if (String(file).endsWith(".candidate")) {
              if (fs.statSync(file, { bigint: true }).ino !== fs.fstatSync(3, { bigint: true }).ino) {
                throw new Error("The editor must still hold the displaced inode.");
              }
              const edit = spawnSync(process.execPath, [
                "--input-type=module", "-e",
                'import { writeSync } from "node:fs"; writeSync(3, "Late external write.\\\\r\\\\n");',
              ], { stdio: ["ignore", "inherit", "inherit", 3], timeout: 20000 });
              if (edit.status !== 0) throw new Error("The editor failed to write to its open descriptor.");
            }
            remove(file, options);
          };
        }
        syncBuiltinESMExports();
        const { transactionFs } = await import(platform);
        const exchange = transactionFs.exchange;
        let calls = 0;
        transactionFs.exchange = (file, staged) => {
          calls++;
          if (mode === "compensation-crash") {
            const edited = targetFile + ".editor";
            fs.writeFileSync(edited, fs.readFileSync(targetFile));
            fs.renameSync(edited, targetFile);
          }
          if (calls === 1) {
            if (mode === "before") process.kill(process.pid, "SIGKILL");
            if (mode === "live-writer") {
              const probe = spawnSync(process.execPath, [
                "--experimental-transform-types", "--input-type=module", "-e",
                \`
                  const [entry, options, input] = process.argv.slice(1);
                  const { commitProjectStatus, recoverProjectStatus } = await import(entry);
                  const scope = JSON.parse(options);
                  const outcomes = [];
                  for (const operation of [
                    () => commitProjectStatus(scope, JSON.parse(input)),
                    () => recoverProjectStatus(scope),
                  ]) {
                    try { operation(); outcomes.push("unexpected success"); }
                    catch (error) { outcomes.push(error.code); }
                  }
                  process.stdout.write(JSON.stringify(outcomes));
                \`, entry, scope, change,
              ], { encoding: "utf8", timeout: 20000 });
              if (probe.status !== 0) throw new Error(probe.stderr || String(probe.error));
              fs.writeFileSync(path.join(JSON.parse(scope).stateDirectory, "probe.json"), probe.stdout);
              process.kill(process.pid, "SIGKILL");
            }
            if (mode === "apply-race" || mode === "second-race") {
              fs.appendFileSync(targetFile, "External edit at apply exchange.\\r\\n");
            }
            if (mode === "recovery-race") {
              const edited = targetFile + ".editor";
              fs.writeFileSync(edited, Buffer.concat([
                fs.readFileSync(targetFile), Buffer.from("External save at recovery exchange.\\r\\n"),
              ]));
              fs.renameSync(edited, targetFile);
            }
          }
          if (calls === 2 && mode === "second-race") {
            fs.appendFileSync(targetFile, "Another edit at compensating exchange.\\r\\n");
          }
          exchange(file, staged);
          if (mode === "after" || mode === "recovery-after") process.kill(process.pid, "SIGKILL");
          if (mode === "compensation-crash" && calls === 2) process.kill(process.pid, "SIGKILL");
        };
        const { commitProjectStatus, recoverProjectStatus } = await import(entry);
        if (mode === "recovery-race" || mode === "recovery-after" || mode === "open-editor") {
          const receipt = recoverProjectStatus(JSON.parse(scope));
          process.stdout.write(JSON.stringify(receipt));
        }
        else commitProjectStatus(JSON.parse(scope), JSON.parse(change));
      `,
      new URL("./index.ts", import.meta.url).href,
      new URL("./posix.ts", import.meta.url).href,
      mode,
      file,
      JSON.stringify(scope),
      JSON.stringify(change),
    ],
    {
      encoding: "utf8",
      timeout: childTimeout,
      stdio: ["ignore", "pipe", "pipe", ...(editorFd === undefined ? [] : [editorFd])],
    },
  );
}

function interrupt(phase: "before" | "after"): void {
  const run = runChild(phase);
  expect(run.signal, run.stderr).toBe("SIGKILL");
}

function expectManualRecovery(): ProjectStatusJournal {
  const journal = pending();
  expect(journal.state).toBe("recovery_required");
  expect(readFileSync(path.join(journalDirectory, `${journal.id}.snapshot`)).equals(before)).toBe(true);
  return journal;
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
  const staged = path.join(path.dirname(project), `.ideomy-${receipt.id}.tmp`);
  const proof = path.join(path.dirname(project), `.ideomy-${receipt.id}.candidate`);
  expect(receipt.retainedPaths).toEqual([staged, proof]);
  expect(readFileSync(path.join(scope.vaultRoot, staged)).equals(before)).toBe(true);
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

it("rejects a mismatched bound Vault before claiming transaction state", () => {
  const mismatched = { ...scope, vaultFingerprint: "0".repeat(64) };
  expect(() => recoverProjectStatus(mismatched)).toThrowError(expect.objectContaining({ code: "TX-INVALID" }));
  expect(() => commitProjectStatus(mismatched, change)).toThrowError(expect.objectContaining({ code: "TX-INVALID" }));
  expect(existsSync(path.join(scope.stateDirectory, "transactions.lock"))).toBe(false);
  expect(readFileSync(file)).toEqual(before);
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
  const recovered = recoverProjectStatus(scope);
  expect(recovered).toMatchObject({ id: journal.id, state: "rolled_back" });
  expect(readFileSync(file).equals(before)).toBe(true);
  const retained = phase === "after" ? [path.join(path.dirname(project), `.ideomy-${journal.id}.tmp`)] : [];
  expect(recovered?.retainedPaths ?? []).toEqual(retained);
  expect(readdirSync(path.dirname(file)).sort()).toEqual(
    [...retained.map((entry) => path.basename(entry)), path.basename(file)].sort(),
  );
  expect(readdirSync(journalDirectory)).toEqual([`${journal.id}.json`]);
  expect(recoverProjectStatus(scope)).toBeNull();
  expect(commitProjectStatus(scope, change).state).toBe("committed");
});

it("holds the claim against both operations in another process and recovers after SIGKILL", {
  timeout: childTimeout + 5_000,
}, () => {
  const run = runChild("live-writer");
  expect(run.signal, run.stderr).toBe("SIGKILL");
  expect(JSON.parse(readFileSync(path.join(scope.stateDirectory, "probe.json"), "utf8"))).toEqual([
    "TX-BUSY",
    "TX-BUSY",
  ]);
  const journal = pending();
  expect(journal.state).toBe("applying");
  expect(readFileSync(file).equals(before)).toBe(true);
  expect(readFileSync(path.join(journalDirectory, `${journal.id}.snapshot`)).equals(before)).toBe(true);
  const lock = path.join(scope.stateDirectory, "transactions.lock");
  const inode = statSync(lock, { bigint: true }).ino;
  // Stale PID contents cannot attach the lock to an unrelated, live process.
  writeFileSync(lock, String(process.pid));
  expect(recoverProjectStatus(scope)).toMatchObject({ id: journal.id, state: "rolled_back" });
  expect(statSync(lock, { bigint: true }).ino).toBe(inode);
  expect(commitProjectStatus(scope, change).state).toBe("committed");
});

it.each([
  ["apply-race", "External edit at apply exchange.\r\n"],
  ["recovery-race", "External save at recovery exchange.\r\n"],
] as const)(
  "preserves an external write after the final hash check during %s",
  {
    timeout: childTimeout * 2 + 5_000,
  },
  (mode, edit) => {
    if (mode === "recovery-race") interrupt("after");
    const external = Buffer.concat([readFileSync(file), Buffer.from(edit)]);
    const run = runChild(mode);
    expect(run.status, run.stderr).toBe(1);
    expect(run.stderr).toContain("TX-RECOVERY-REQUIRED");
    expect(readFileSync(file).equals(external)).toBe(true);
    expectManualRecovery();
    expect(() => recoverProjectStatus(scope)).toThrowError(expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }));
    expect(readFileSync(file).equals(external)).toBe(true);
  },
);

it("retains both external versions when an editor also races the compensating exchange", {
  timeout: childTimeout + 5_000,
}, () => {
  const run = runChild("second-race");
  expect(run.status, run.stderr).toBe(1);
  expect(run.stderr).toContain("TX-RECOVERY-REQUIRED");
  const journal = expectManualRecovery();
  const first = Buffer.concat([before, Buffer.from("External edit at apply exchange.\r\n")]);
  const second = Buffer.concat([after, Buffer.from("Another edit at compensating exchange.\r\n")]);
  expect(readFileSync(file).equals(first)).toBe(true);
  expect(readFileSync(path.join(path.dirname(file), `.ideomy-${journal.id}.tmp`)).equals(second)).toBe(true);
});

it("remembers the conflict across SIGKILL after compensation when both external hashes match the plan", {
  timeout: childTimeout + 5_000,
}, () => {
  const run = runChild("compensation-crash");
  expect(run.signal, run.stderr).toBe("SIGKILL");
  const journal = pending();
  expect(journal.state).toBe("recovery_required");
  const slot = path.join(path.dirname(file), `.ideomy-${journal.id}.tmp`);
  const externalBefore = statSync(file, { bigint: true }).ino;
  const externalAfter = statSync(slot, { bigint: true }).ino;
  const proof = statSync(path.join(path.dirname(file), `.ideomy-${journal.id}.candidate`), { bigint: true });
  expect(externalAfter).not.toBe(proof.ino);
  expect(readFileSync(file).equals(before)).toBe(true);
  expect(readFileSync(slot).equals(after)).toBe(true);
  expect(() => recoverProjectStatus(scope)).toThrowError(expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }));
  expectManualRecovery();
  expect(statSync(file, { bigint: true }).ino).toBe(externalBefore);
  expect(statSync(slot, { bigint: true }).ino).toBe(externalAfter);
  expect(readFileSync(file).equals(before)).toBe(true);
  expect(readFileSync(slot).equals(after)).toBe(true);
});

it("keeps a late write to the displaced inode after rollback cleanup and editor close", {
  timeout: childTimeout * 2 + 5_000,
}, () => {
  interrupt("after");
  const journal = pending();
  const editor = openSync(file, "a");
  let receipt: ProjectStatusJournal;
  try {
    const recovery = runChild("open-editor", editor);
    expect(recovery.status, recovery.stderr).toBe(0);
    receipt = JSON.parse(recovery.stdout);
  } finally {
    closeSync(editor);
  }
  expect(receipt.state).toBe("rolled_back");
  expect(readFileSync(file).equals(before)).toBe(true);
  const slot = path.join(path.dirname(file), `.ideomy-${journal.id}.tmp`);
  const latest = Buffer.concat([after, Buffer.from("Late external write.\r\n")]);
  expect(readFileSync(slot).equals(latest)).toBe(true);
  expect(receipt.retainedPaths).toContain(path.relative(scope.vaultRoot, slot));
  const archived = JSON.parse(readFileSync(path.join(journalDirectory, `${journal.id}.json`), "utf8"));
  expect(archived).toEqual(receipt);
  expect(recoverProjectStatus(scope)).toBeNull();
});

it.each([
  "before",
  "after",
] as const)("preserves identical candidate bytes supplied by an external editor after a crash %s exchange", {
  timeout: childTimeout + 5_000,
}, (phase) => {
  interrupt(phase);
  const journal = pending();
  const proof = statSync(path.join(path.dirname(file), `.ideomy-${journal.id}.candidate`), { bigint: true });
  expect(journal.candidateIdentity).toBe(`${proof.dev}:${proof.ino}`);
  const edited = `${file}.editor`;
  writeFileSync(edited, after);
  renameSync(edited, file);
  const external = statSync(file, { bigint: true });
  expect(external.ino).not.toBe(proof.ino);
  expect(() => recoverProjectStatus(scope)).toThrowError(expect.objectContaining({ code: "TX-RECOVERY-REQUIRED" }));
  expect(readFileSync(file).equals(after)).toBe(true);
  expect(statSync(file, { bigint: true }).ino).toBe(external.ino);
  expectManualRecovery();
});

it("resumes recovery after a second SIGKILL just after the rollback exchange", {
  timeout: childTimeout * 2 + 5_000,
}, () => {
  interrupt("after");
  const { id } = pending();
  const run = runChild("recovery-after");
  expect(run.signal, run.stderr).toBe("SIGKILL");
  expect(readFileSync(file).equals(before)).toBe(true);
  const retained = path.join(path.dirname(project), `.ideomy-${id}.tmp`);
  expect(recoverProjectStatus(scope)).toMatchObject({ id, state: "rolled_back", retainedPaths: [retained] });
  expect(readFileSync(file).equals(before)).toBe(true);
  expect(readFileSync(path.join(scope.vaultRoot, retained)).equals(after)).toBe(true);
  expect(readdirSync(journalDirectory)).toEqual([`${id}.json`]);
  expect(readdirSync(path.dirname(file)).sort()).toEqual([path.basename(retained), path.basename(file)].sort());
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
