import { type FSWatcher, readFileSync, realpathSync, watch } from "node:fs";
import { hashRaw, resolveVaultFile, scanVault, VaultError } from "./index.ts";

export type VaultFileEvent = {
  kind: "create" | "change" | "unlink" | "error";
  path: string;
  hash?: string;
  code?: string;
};

export class OwnWriteTracker {
  private readonly expected = new Map<string, string>();

  record(relativePath: string, committedHash: string): void {
    this.expected.set(relativePath, committedHash);
  }

  consume(relativePath: string, observedHash: string): boolean {
    const expected = this.expected.get(relativePath);
    this.expected.delete(relativePath);
    return expected === observedHash;
  }
}

export class VaultWatcher {
  private readonly root: string;
  private readonly known = new Map<string, string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly onEvent: (event: VaultFileEvent) => void;
  private readonly debounceMs: number;
  readonly ownWrites = new OwnWriteTracker();
  private watcher: FSWatcher | undefined;

  constructor(root: string, onEvent: (event: VaultFileEvent) => void, debounceMs = 100) {
    this.root = realpathSync(root);
    this.onEvent = onEvent;
    this.debounceMs = debounceMs;
    for (const entry of scanVault(this.root).notes) this.known.set(entry.path, entry.note.hash);
  }

  start(): void {
    if (this.watcher) return;
    this.watcher = watch(this.root, { recursive: true }, (_event, filename) => {
      const relative = filename?.toString();
      const key = relative?.endsWith(".md") ? relative : "*";
      const pending = this.timers.get(key);
      if (pending) clearTimeout(pending);
      this.timers.set(
        key,
        setTimeout(() => {
          this.timers.delete(key);
          if (key === "*") this.reconcileAll();
          else this.reconcile(key);
        }, this.debounceMs),
      );
    });
    this.watcher.on("error", () => this.onEvent({ kind: "error", path: "", code: "VAULT-110" }));
  }

  close(): void {
    this.watcher?.close();
    this.watcher = undefined;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  reconcile(relativePath: string): void {
    try {
      const bytes = readFileSync(resolveVaultFile(this.root, relativePath));
      this.observe(relativePath, hashRaw(bytes));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (this.known.delete(relativePath)) this.onEvent({ kind: "unlink", path: relativePath });
      } else {
        this.onEvent({
          kind: "error",
          path: relativePath,
          code: error instanceof VaultError ? error.code : "VAULT-110",
        });
      }
    }
  }

  reconcileAll(): void {
    let current: Map<string, string>;
    let unreadable: Set<string>;
    try {
      const scan = scanVault(this.root);
      unreadable = new Set(
        scan.diagnostics.filter((entry) => entry.code === "VAULT-110").map((entry) => entry.path ?? ""),
      );
      for (const diagnostic of scan.diagnostics) {
        if (diagnostic.severity === "error") {
          this.onEvent({ kind: "error", path: diagnostic.path ?? "", code: diagnostic.code });
        }
      }
      current = new Map(scan.notes.map((entry) => [entry.path, entry.note.hash]));
    } catch {
      this.onEvent({ kind: "error", path: "", code: "VAULT-110" });
      return;
    }
    for (const [relativePath, hash] of current) this.observe(relativePath, hash);
    for (const relativePath of this.known.keys()) {
      if (!current.has(relativePath) && !unreadable.has(relativePath)) {
        this.known.delete(relativePath);
        this.onEvent({ kind: "unlink", path: relativePath });
      }
    }
  }

  private observe(relativePath: string, hash: string): void {
    const before = this.known.get(relativePath);
    if (before === hash) return;
    this.known.set(relativePath, hash);
    if (this.ownWrites.consume(relativePath, hash)) return;
    this.onEvent({ kind: before ? "change" : "create", path: relativePath, hash });
  }
}
