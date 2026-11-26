import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { entitySchemas } from "@ideomy/schema";
import {
  deriveVaultFingerprint,
  hashRaw,
  parseMarkdown,
  planScalarPropertyChange,
  resolveVaultFile,
  scanVault,
} from "@ideomy/vault-io";
import { z } from "zod";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const projectId = entitySchemas.project.shape.id;
const projectStatus = entitySchemas.project.shape.status;
const pendingSchema = z.strictObject({ id: z.uuid() });
const journalSchema = z.strictObject({
  version: z.literal(1),
  id: z.uuid(),
  vaultFingerprint: sha256,
  projectId,
  path: z.string().min(1),
  beforeHash: sha256,
  afterHash: sha256,
  previousStatus: projectStatus,
  status: projectStatus,
  state: z.enum(["snapshotted", "applying", "validating", "committed", "rolled_back", "recovery_required"]),
});

export type ProjectStatusJournal = z.infer<typeof journalSchema>;
export type TransactionScope = {
  vaultRoot: string;
  vaultId: string;
  /** The caller holds exclusive Core ownership of this directory during writes and recovery. */
  stateDirectory: string;
  propertyMapping?: Record<string, string>;
};
export type ProjectStatusChange = { projectId: string; status: string; expectedHash: string };
export class TransactionError extends Error {
  constructor(
    readonly code: "TX-CONFLICT" | "TX-INVALID" | "TX-RECOVERY-REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "TransactionError";
  }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function syncDirectory(directory: string): void {
  if (process.platform === "win32") return;
  const file = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    fsyncSync(file);
  } finally {
    closeSync(file);
  }
}

function readRegular(file: string): { bytes: Buffer; mode: number } {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new TransactionError("TX-INVALID", "Expected a regular file.");
    return { bytes: readFileSync(fd), mode: stat.mode & 0o777 };
  } finally {
    closeSync(fd);
  }
}

function writeDurable(file: string, bytes: Buffer | string, mode = 0o600): void {
  const fd = openSync(file, "wx", 0o600);
  try {
    writeFileSync(fd, bytes);
    if (mode !== 0o600) fchmodSync(fd, mode);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function privateDirectory(directory: string): void {
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) {
    throw new TransactionError("TX-INVALID", "Transaction state must use private machine-local directories.");
  }
}

function statePaths(scope: TransactionScope) {
  const vault = realpathSync(scope.vaultRoot);
  const state = realpathSync(scope.stateDirectory);
  if (!scope.vaultId) throw new TransactionError("TX-INVALID", "Vault identity is required.");
  const fingerprint = deriveVaultFingerprint(vault, scope.vaultId);
  const parent = path.join(state, "transactions");
  const directory = path.join(parent, fingerprint);
  const relative = path.relative(vault, directory);
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    throw new TransactionError("TX-INVALID", "Transaction state belongs outside the Vault.");
  }
  privateDirectory(state);
  for (const child of [parent, directory]) {
    try {
      mkdirSync(child, { mode: 0o700 });
      syncDirectory(path.dirname(child));
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    }
    privateDirectory(child);
  }
  return { vault, fingerprint, directory, active: path.join(directory, "active.json") };
}

function notePath(root: string, relative: string): string {
  const resolved = resolveVaultFile(root, relative);
  if (resolved !== path.resolve(root, relative) || path.extname(resolved) !== ".md") {
    throw new TransactionError("TX-INVALID", "Transaction target must be a canonical Vault Markdown file.");
  }
  return resolved;
}

function requireHash(bytes: Uint8Array, expected: string): void {
  if (hashRaw(bytes) !== expected) {
    throw new TransactionError("TX-CONFLICT", "Vault Markdown changed since the status change was planned.");
  }
}

function replaceNote(root: string, relative: string, temporary: string, bytes: Buffer, expected: string): void {
  const file = notePath(root, relative);
  const current = readRegular(file);
  requireHash(current.bytes, expected);
  writeDurable(temporary, bytes, current.mode);
  try {
    requireHash(readRegular(notePath(root, relative)).bytes, expected);
    renameSync(temporary, file);
    syncDirectory(path.dirname(file));
  } finally {
    rmSync(temporary, { force: true });
  }
}

function files(directory: string, id: string) {
  return {
    claim: path.join(directory, `${id}.claim`),
    journal: path.join(directory, `${id}.json`),
    snapshot: path.join(directory, `${id}.snapshot`),
  };
}

function saveJournal(file: string, journal: ProjectStatusJournal): ProjectStatusJournal {
  const temporary = `${file}.next`;
  writeDurable(temporary, JSON.stringify(journal));
  renameSync(temporary, file);
  syncDirectory(path.dirname(file));
  return journal;
}

function finish(active: string, transaction: ReturnType<typeof files>): void {
  rmSync(transaction.snapshot, { force: true });
  rmSync(`${transaction.journal}.next`, { force: true });
  rmSync(transaction.claim, { force: true });
  rmSync(active);
  syncDirectory(path.dirname(active));
}

function readState<T>(file: string, schema: z.ZodType<T>): T | null {
  try {
    return schema.parse(JSON.parse(readRegular(file).bytes.toString("utf8")));
  } catch (error) {
    if (hasCode(error, "ENOENT")) return null;
    throw new TransactionError("TX-RECOVERY-REQUIRED", "Transaction state is unreadable or invalid.");
  }
}

function claim(active: string, claimFile: string, id: string): void {
  writeDurable(claimFile, JSON.stringify({ id }));
  try {
    // Publish a complete claim without replacing a different pending transaction.
    linkSync(claimFile, active);
    syncDirectory(path.dirname(active));
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
    rmSync(claimFile);
    throw new TransactionError("TX-RECOVERY-REQUIRED", "A transaction already owns this Vault's journal.");
  }
}

function stagedNote(file: string, id: string): string {
  return path.join(path.dirname(file), `.ideomy-${id}.tmp`);
}

/** Apply one typed Project status change. The caller provides the Vault's machine-local state directory. */
export function commitProjectStatus(scope: TransactionScope, change: ProjectStatusChange): ProjectStatusJournal {
  const { vault, fingerprint, directory, active } = statePaths(scope);
  if (readState(active, pendingSchema)) {
    throw new TransactionError("TX-RECOVERY-REQUIRED", "Recover the pending Vault transaction before writing.");
  }
  const id = projectId.parse(change.projectId);
  const status = projectStatus.parse(change.status);
  const expectedHash = sha256.parse(change.expectedHash);
  const target = scanVault(vault, scope.propertyMapping).notes.find(({ note }) => note.logicalProperties?.id === id);
  if (target?.note.kind !== "managed" || target.note.logicalProperties?.type !== "project") {
    throw new TransactionError("TX-INVALID", "Expected a unique, valid managed Project.");
  }
  requireHash(target.note.raw, expectedHash);
  const previousStatus = projectStatus.parse(target.note.logicalProperties.status);
  if (previousStatus === status) {
    throw new TransactionError("TX-INVALID", "Project already has the requested status.");
  }
  const plan = planScalarPropertyChange(target.note, "status", status);
  const transactionId = randomUUID();
  const transaction = files(directory, transactionId);
  const file = notePath(vault, target.path);
  claim(active, transaction.claim, transactionId);
  writeDurable(transaction.snapshot, target.note.raw);
  const journal = saveJournal(transaction.journal, {
    version: 1,
    id: transactionId,
    vaultFingerprint: fingerprint,
    projectId: id,
    path: target.path,
    beforeHash: plan.preconditionHash,
    afterHash: plan.candidateHash,
    previousStatus,
    status,
    state: "snapshotted",
  });
  saveJournal(transaction.journal, { ...journal, state: "applying" });
  try {
    replaceNote(vault, journal.path, stagedNote(file, transactionId), plan.candidate, journal.beforeHash);
  } catch (error) {
    if (error instanceof TransactionError && error.code === "TX-CONFLICT") {
      saveJournal(transaction.journal, { ...journal, state: "rolled_back" });
      finish(active, transaction);
    }
    throw error;
  }
  saveJournal(transaction.journal, { ...journal, state: "validating" });
  const written = parseMarkdown(readRegular(notePath(vault, journal.path)).bytes, scope.propertyMapping);
  if (
    written.hash !== journal.afterHash ||
    written.kind !== "managed" ||
    written.logicalProperties?.id !== id ||
    written.logicalProperties.status !== status
  ) {
    saveJournal(transaction.journal, { ...journal, state: "recovery_required" });
    throw new TransactionError("TX-RECOVERY-REQUIRED", "Post-write validation did not confirm the planned change.");
  }
  const committed = saveJournal(transaction.journal, { ...journal, state: "committed" });
  finish(active, transaction);
  return committed;
}

/** Run on startup while holding exclusive Core ownership of the machine-local state directory. */
export function recoverProjectStatus(scope: TransactionScope): ProjectStatusJournal | null {
  const { vault, fingerprint, directory, active } = statePaths(scope);
  const pending = readState(active, pendingSchema);
  if (!pending) return null;
  const transaction = files(directory, pending.id);
  const journal = readState(transaction.journal, journalSchema);
  if (!journal) {
    // The first journal record is made durable before staging any Vault bytes.
    finish(active, transaction);
    return null;
  }
  if (journal.id !== pending.id || journal.vaultFingerprint !== fingerprint) {
    throw new TransactionError("TX-RECOVERY-REQUIRED", "Pending transaction identity does not match this Vault.");
  }
  if (journal.state === "committed" || journal.state === "rolled_back") {
    finish(active, transaction);
    return journal;
  }
  rmSync(`${transaction.journal}.next`, { force: true });
  try {
    const file = notePath(vault, journal.path);
    const temporary = stagedNote(file, journal.id);
    const actual = hashRaw(readRegular(file).bytes);
    rmSync(temporary, { force: true });
    if (actual !== journal.beforeHash) {
      if (actual !== journal.afterHash) {
        throw new TransactionError("TX-RECOVERY-REQUIRED", "Vault Markdown changed after the interrupted write.");
      }
      const snapshot = readRegular(transaction.snapshot).bytes;
      requireHash(snapshot, journal.beforeHash);
      const original = parseMarkdown(snapshot, scope.propertyMapping);
      if (
        original.kind !== "managed" ||
        original.logicalProperties?.id !== journal.projectId ||
        original.logicalProperties.status !== journal.previousStatus
      ) {
        throw new TransactionError("TX-RECOVERY-REQUIRED", "Recovery snapshot does not contain the original Project.");
      }
      replaceNote(vault, journal.path, temporary, snapshot, journal.afterHash);
      requireHash(readRegular(notePath(vault, journal.path)).bytes, journal.beforeHash);
    }
  } catch {
    saveJournal(transaction.journal, { ...journal, state: "recovery_required" });
    throw new TransactionError("TX-RECOVERY-REQUIRED", "The interrupted Project transaction needs manual recovery.");
  }
  const rolledBack = saveJournal(transaction.journal, { ...journal, state: "rolled_back" });
  finish(active, transaction);
  return rolledBack;
}
