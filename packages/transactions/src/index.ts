import { randomUUID } from "node:crypto";
import {
  type BigIntStats,
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
import { transactionFs } from "./posix.ts";

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
  candidateIdentity: z
    .string()
    .regex(/^\d+:\d+$/)
    .optional(),
  rollbackStarted: z.boolean().optional(),
  retainedPaths: z.array(z.string().min(1)).optional(),
  previousStatus: projectStatus,
  status: projectStatus,
  state: z.enum(["snapshotted", "applying", "validating", "committed", "rolled_back", "recovery_required"]),
});

export type ProjectStatusJournal = z.infer<typeof journalSchema>;
export type TransactionScope = {
  vaultRoot: string;
  vaultId: string;
  vaultFingerprint?: string;
  stateDirectory: string;
  propertyMapping?: Record<string, string>;
};
export type ProjectStatusChange = { projectId: string; status: string; expectedHash: string };
type TransactionErrorCode = "TX-BUSY" | "TX-CONFLICT" | "TX-INVALID" | "TX-RECOVERY-REQUIRED";
export class TransactionError extends Error {
  readonly code: TransactionErrorCode;

  constructor(code: TransactionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TransactionError";
    this.code = code;
  }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function syncDirectory(directory: string): void {
  const file = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    fsyncSync(file);
  } finally {
    closeSync(file);
  }
}

function identity(stat: BigIntStats): string {
  return `${stat.dev}:${stat.ino}`;
}

function readRegular(file: string): { bytes: Buffer; mode: number; identity: string } {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd, { bigint: true });
    if (!stat.isFile()) throw new TransactionError("TX-INVALID", "Expected a regular file.");
    return { bytes: readFileSync(fd), mode: Number(stat.mode & 0o777n), identity: identity(stat) };
  } finally {
    closeSync(fd);
  }
}

function writeDurable(file: string, bytes: Buffer | string, mode = 0o600): string {
  const fd = openSync(file, "wx", 0o600);
  try {
    writeFileSync(fd, bytes);
    if (mode !== 0o600) fchmodSync(fd, mode);
    fsyncSync(fd);
    return identity(fstatSync(fd, { bigint: true }));
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

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

type StatePaths = { vault: string; fingerprint: string; directory: string; active: string };

function withStateLock<T>(scope: TransactionScope, run: (paths: StatePaths) => T): T {
  const vault = realpathSync(scope.vaultRoot);
  const state = realpathSync(scope.stateDirectory);
  if (!scope.vaultId) throw new TransactionError("TX-INVALID", "Vault identity is required.");
  const fingerprint = deriveVaultFingerprint(vault, scope.vaultId);
  if (scope.vaultFingerprint !== undefined && scope.vaultFingerprint !== fingerprint) {
    throw new TransactionError("TX-INVALID", "The transaction Vault does not match the bound identity.");
  }
  const parent = path.join(state, "transactions");
  const directory = path.join(parent, fingerprint);
  if (isWithin(vault, state) || isWithin(vault, directory)) {
    throw new TransactionError("TX-INVALID", "Transaction state belongs outside the Vault.");
  }
  privateDirectory(state);
  const lockFile = path.join(state, "transactions.lock");
  const fd = openSync(
    lockFile,
    constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    0o600,
  );
  try {
    const lock = fstatSync(fd, { bigint: true });
    if (!lock.isFile() || lock.nlink !== 1n || (lock.mode & 0o077n) !== 0n) {
      throw new TransactionError("TX-INVALID", "Expected a private regular state lock file.");
    }
    if (!transactionFs.tryLock(fd)) {
      throw new TransactionError("TX-BUSY", "Another process is using this transaction state directory.");
    }
    if (identity(lstatSync(lockFile, { bigint: true })) !== identity(lock)) {
      throw new TransactionError("TX-INVALID", "The state lock file changed during acquisition.");
    }
    for (const child of [parent, directory]) {
      try {
        mkdirSync(child, { mode: 0o700 });
        syncDirectory(path.dirname(child));
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
      }
      privateDirectory(child);
    }
    return run({ vault, fingerprint, directory, active: path.join(directory, "active.json") });
  } finally {
    // Keep the lock inode at this path. The kernel releases its lock when the descriptor closes.
    closeSync(fd);
  }
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

type FileVersion = { identity: string; hash: string };

function version(file: string): FileVersion | null {
  try {
    const current = readRegular(file);
    return { identity: current.identity, hash: hashRaw(current.bytes) };
  } catch (error) {
    if (hasCode(error, "ENOENT")) return null;
    throw error;
  }
}

function sameVersion(actual: FileVersion | null, expected: FileVersion): boolean {
  return actual?.identity === expected.identity && actual.hash === expected.hash;
}

function exchangeChecked(
  file: string,
  slot: string,
  current: FileVersion,
  replacement: FileVersion,
  persistConflict: () => void,
): void {
  if (!sameVersion(version(slot), replacement)) {
    throw new TransactionError("TX-RECOVERY-REQUIRED", "The staged version changed before atomic exchange.");
  }
  if (!sameVersion(version(file), current)) {
    throw new TransactionError("TX-CONFLICT", "Vault Markdown changed before atomic exchange.");
  }
  transactionFs.exchange(file, slot);
  const displaced = version(slot);
  const published = version(file);
  if (!sameVersion(displaced, current) || !sameVersion(published, replacement)) {
    if (displaced && sameVersion(published, replacement)) {
      // Recovery must see the conflict even if compensation leaves both planned hashes on disk.
      persistConflict();
      transactionFs.exchange(file, slot);
    }
    throw new TransactionError("TX-RECOVERY-REQUIRED", "A concurrent edit changed the exchanged files.");
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

function stagedFiles(vault: string, relative: string, id: string) {
  const file = path.resolve(vault, relative);
  const directory = path.dirname(file);
  if (
    path.isAbsolute(relative) ||
    relative.includes("\0") ||
    file === vault ||
    !isWithin(vault, file) ||
    path.extname(file) !== ".md" ||
    directory !== realpathSync(directory)
  ) {
    throw new TransactionError("TX-INVALID", "The staged files must be beside a Vault Markdown file.");
  }
  return {
    slot: path.join(directory, `.ideomy-${id}.tmp`),
    proof: path.join(directory, `.ideomy-${id}.candidate`),
  };
}

function recordRecoveryRequired(transaction: ReturnType<typeof files>, journal: ProjectStatusJournal): void {
  saveJournal(transaction.journal, { ...journal, state: "recovery_required" });
}

function requireManualRecovery(transaction: ReturnType<typeof files>, journal: ProjectStatusJournal, cause: unknown) {
  recordRecoveryRequired(transaction, journal);
  return new TransactionError("TX-RECOVERY-REQUIRED", "The Project transaction needs manual recovery.", { cause });
}

function finishTerminal(
  paths: StatePaths,
  transaction: ReturnType<typeof files>,
  journal: ProjectStatusJournal,
): ProjectStatusJournal {
  const staged = stagedFiles(paths.vault, journal.path, journal.id);
  const committed = journal.state === "committed";
  let slot: FileVersion | null;
  let proof: FileVersion | null;
  try {
    slot = version(staged.slot);
    proof = version(staged.proof);
    const expectedSlotHash = committed ? journal.beforeHash : journal.afterHash;
    if (
      slot &&
      (slot.hash !== expectedSlotHash ||
        (!committed && journal.candidateIdentity && slot.identity !== journal.candidateIdentity))
    ) {
      throw new Error("The staged file contains an unrecognized version.");
    }
    if (
      proof &&
      (proof.hash !== journal.afterHash || (journal.candidateIdentity && proof.identity !== journal.candidateIdentity))
    ) {
      throw new Error("The candidate hard link changed.");
    }
  } catch (error) {
    throw requireManualRecovery(transaction, journal, error);
  }
  const mayHaveBeenPublished =
    committed || (journal.candidateIdentity !== undefined && (journal.rollbackStarted !== false || !slot));
  const keepSlot = mayHaveBeenPublished && slot !== null;
  const keepProof = mayHaveBeenPublished && proof !== null && proof.identity !== slot?.identity;
  const retained = [keepSlot ? staged.slot : null, keepProof ? staged.proof : null].filter((file) => file !== null);
  if (retained.length) {
    // Keep a name on the Vault filesystem for each inode that an editor may still have open.
    journal = saveJournal(transaction.journal, {
      ...journal,
      retainedPaths: retained.map((file) => path.relative(paths.vault, file)),
    });
  }
  if (!keepSlot) rmSync(staged.slot, { force: true });
  if (!keepProof) rmSync(staged.proof, { force: true });
  syncDirectory(path.dirname(staged.slot));
  finish(paths.active, transaction);
  return journal;
}

/** Apply one typed Project status change. The caller provides the Vault's machine-local state directory. */
export function commitProjectStatus(scope: TransactionScope, change: ProjectStatusChange): ProjectStatusJournal {
  return withStateLock(scope, (paths) => commitLocked(paths, scope, change));
}

function commitLocked(paths: StatePaths, scope: TransactionScope, change: ProjectStatusChange): ProjectStatusJournal {
  const { vault, fingerprint, directory, active } = paths;
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
  const current = readRegular(file);
  requireHash(current.bytes, plan.preconditionHash);
  const staged = stagedFiles(vault, target.path, transactionId);
  claim(active, transaction.claim, transactionId);
  writeDurable(transaction.snapshot, target.note.raw);
  const snapshotted = saveJournal(transaction.journal, {
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
  const candidateIdentity = writeDurable(staged.slot, plan.candidate, current.mode);
  // Pin the staged inode so a later external file cannot reuse its identity.
  linkSync(staged.slot, staged.proof);
  syncDirectory(path.dirname(file));
  const journal = saveJournal(transaction.journal, {
    ...snapshotted,
    candidateIdentity,
    rollbackStarted: false,
    state: "applying",
  });
  try {
    exchangeChecked(
      file,
      staged.slot,
      { identity: current.identity, hash: journal.beforeHash },
      { identity: candidateIdentity, hash: journal.afterHash },
      () => recordRecoveryRequired(transaction, journal),
    );
  } catch (error) {
    if (error instanceof TransactionError && error.code === "TX-CONFLICT") {
      const rolledBack = saveJournal(transaction.journal, { ...journal, state: "rolled_back" });
      finishTerminal(paths, transaction, rolledBack);
      throw error;
    }
    throw requireManualRecovery(transaction, journal, error);
  }
  const validating = saveJournal(transaction.journal, { ...journal, state: "validating" });
  try {
    const published = readRegular(notePath(vault, journal.path));
    const written = parseMarkdown(published.bytes, scope.propertyMapping);
    if (
      published.identity !== candidateIdentity ||
      written.hash !== journal.afterHash ||
      written.kind !== "managed" ||
      written.logicalProperties?.id !== id ||
      written.logicalProperties.status !== status
    ) {
      throw new Error("Post-write validation did not confirm the plan.");
    }
  } catch (error) {
    throw requireManualRecovery(transaction, validating, error);
  }
  const committed = saveJournal(transaction.journal, { ...journal, state: "committed" });
  return finishTerminal(paths, transaction, committed);
}

/** Recover a pending Project status change under the same OS lock used for commits. */
export function recoverProjectStatus(scope: TransactionScope): ProjectStatusJournal | null {
  return withStateLock(scope, (paths) => recoverLocked(paths, scope));
}

function recoverLocked(paths: StatePaths, scope: TransactionScope): ProjectStatusJournal | null {
  const { vault, fingerprint, directory, active } = paths;
  const pending = readState(active, pendingSchema);
  if (!pending) return null;
  const transaction = files(directory, pending.id);
  let journal = readState(transaction.journal, journalSchema);
  if (!journal) {
    // The first journal record is made durable before staging any Vault bytes.
    finish(active, transaction);
    return null;
  }
  if (journal.id !== pending.id || journal.vaultFingerprint !== fingerprint) {
    throw new TransactionError("TX-RECOVERY-REQUIRED", "Pending transaction identity does not match this Vault.");
  }
  rmSync(`${transaction.journal}.next`, { force: true });
  if (journal.state === "committed" || journal.state === "rolled_back") {
    return finishTerminal(paths, transaction, journal);
  }
  if (journal.state === "recovery_required") {
    throw new TransactionError("TX-RECOVERY-REQUIRED", "The Project transaction needs manual recovery.");
  }
  try {
    const file = notePath(vault, journal.path);
    const staged = stagedFiles(vault, journal.path, journal.id);
    const actual = version(file);
    if (actual?.hash !== journal.beforeHash) {
      const candidate = { identity: journal.candidateIdentity ?? "", hash: journal.afterHash };
      const displaced = version(staged.slot);
      if (!sameVersion(version(staged.proof), candidate) || !sameVersion(actual, candidate)) {
        throw new Error("The current Vault file cannot be attributed to this transaction.");
      }
      if (displaced?.hash !== journal.beforeHash) {
        throw new Error("The exchanged original is missing or changed.");
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
      const rollingBack = saveJournal(transaction.journal, { ...journal, rollbackStarted: true });
      journal = rollingBack;
      exchangeChecked(file, staged.slot, candidate, displaced, () => recordRecoveryRequired(transaction, rollingBack));
    }
  } catch (error) {
    throw requireManualRecovery(transaction, journal, error);
  }
  const rolledBack = saveJournal(transaction.journal, { ...journal, state: "rolled_back" });
  return finishTerminal(paths, transaction, rolledBack);
}
