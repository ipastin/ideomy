import { chmodSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { hashRaw, type ParsedNote, scanVault } from "@ideomy/vault-io";
import Database from "better-sqlite3";
import { migrations } from "./migrations.ts";

export const relationTargets = {
  primary_area: "area",
  related_areas: "area",
  projects: "project",
  goals: "goal",
  people: "person",
  organizations: "organization",
  places: "place",
  sources: "source",
  decisions: "decision",
} as const;

const unfinishedTransaction = "SELECT 1 FROM transactions WHERE state NOT IN ('committed', 'rolled_back') LIMIT 1";
const requiredTables = [
  "index_metadata",
  "entities",
  "file_state",
  "relationships",
  "documents",
  "chunks",
  "fts_chunks",
  "transactions",
] as const;

function hasRequiredSchema(db: Database.Database): boolean {
  const rows = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table'").all() as {
    name: string;
    sql: string;
  }[];
  const tables = new Map(rows.map((row) => [row.name, row.sql]));
  return (
    requiredTables.every((name) => tables.has(name)) && /^CREATE VIRTUAL TABLE/i.test(tables.get("fts_chunks") ?? "")
  );
}

export class IndexError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IndexError";
    this.code = code;
  }
}

export interface SqliteStore {
  readonly version: number;
  rebuild(input: IndexInput): string;
  revision(): string | null;
  search(query: string): SearchHit[];
  close(): void;
}

export type IndexInput = {
  vaultRoot: string;
  vaultId: string;
  vaultFingerprint: string;
  propertyMapping?: Record<string, string>;
};

export type SearchHit = { path: string; entityId: string | null; title: string };
export const indexFilename = "structured-index.sqlite";

type Entry = { path: string; note: ParsedNote };

function title(entry: Entry): string {
  return entry.note.structure.headings[0]?.text || path.basename(entry.path, ".md");
}

export function indexRevision(entries: Entry[], input: IndexInput): string {
  return hashRaw(
    Buffer.from(
      JSON.stringify({
        vaultId: input.vaultId,
        vaultFingerprint: input.vaultFingerprint,
        mapping: Object.fromEntries(
          Object.entries(input.propertyMapping ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        ),
        files: entries.map(({ path: file, note }) => [file, note.hash]),
      }),
    ),
  );
}

function resolveTarget(
  target: string,
  entries: Entry[],
  targetType: string,
): { id: string | null; resolution: string } {
  const reference = target.slice(2, -2).split("|", 1)[0]?.split("#", 1)[0]?.replace(/\.md$/i, "") ?? "";
  const managed = entries.filter((entry) => entry.note.kind === "managed");
  const candidates = [
    managed.filter((entry) => entry.path.replace(/\.md$/i, "") === reference),
    managed.filter((entry) => path.basename(entry.path, ".md") === reference || title(entry) === reference),
    managed.filter((entry) => (entry.note.logicalProperties?.aliases as unknown[] | undefined)?.includes(reference)),
  ];
  for (const matches of candidates) {
    if (!matches.length) continue;
    const typed = matches.filter((entry) => entry.note.logicalProperties?.type === targetType);
    if (!typed.length) return { id: null, resolution: "missing" };
    if (typed.length !== 1) return { id: null, resolution: "ambiguous" };
    return { id: typed[0]?.note.logicalProperties?.id as string, resolution: "resolved" };
  }
  return { id: null, resolution: "missing" };
}

export class BetterSqliteStore implements SqliteStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    if (!existsSync(path.dirname(databasePath)))
      mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    this.db = new Database(databasePath);
    try {
      if (statSync(databasePath).mode & 0o077) chmodSync(databasePath, 0o600);
      this.db.pragma("foreign_keys = ON");
      const version = this.db.pragma("user_version", { simple: true }) as number;
      if (version > migrations.length)
        throw new IndexError("INDEX-002", "Index database uses a newer migration version.");
      for (let step = version; step < migrations.length; step++) {
        this.db.transaction(() => {
          this.db.exec(migrations[step] ?? "");
          this.db.pragma(`user_version = ${step + 1}`);
        })();
      }
      if (!hasRequiredSchema(this.db)) throw new IndexError("INDEX-003", "Index database schema is incomplete.");
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  get version(): number {
    return this.db.pragma("user_version", { simple: true }) as number;
  }

  revision(): string | null {
    return (
      (
        this.db.prepare("SELECT value FROM index_metadata WHERE key = 'revision'").get() as
          | { value?: string }
          | undefined
      )?.value ?? null
    );
  }

  rebuild(input: IndexInput): string {
    const scan = scanVault(input.vaultRoot, input.propertyMapping);
    const errors = scan.diagnostics.filter((item) => item.severity === "error");
    if (errors.length)
      throw new IndexError(
        errors[0]?.code ?? "INDEX-003",
        errors.map((item) => `${item.code}: ${item.path ?? ""}`).join("; "),
      );
    const entries = scan.notes;
    const next = indexRevision(entries, input);
    if (this.db.prepare(unfinishedTransaction).get())
      throw new IndexError("INDEX-004", "Incomplete transaction recovery metadata blocks index rebuild.");
    if (this.revision() === next) return next;
    this.db.transaction(() => {
      this.db.exec(
        "DELETE FROM fts_chunks; DELETE FROM chunks; DELETE FROM relationships; DELETE FROM file_state; DELETE FROM documents; DELETE FROM entities; DELETE FROM index_metadata;",
      );
      const entity = this.db.prepare("INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const file = this.db.prepare("INSERT INTO file_state VALUES (?, ?, ?, ?)");
      const document = this.db.prepare("INSERT INTO documents VALUES (?, ?, ?, ?, ?)");
      const chunk = this.db.prepare("INSERT INTO chunks(path, ordinal, content) VALUES (?, 0, ?)");
      const fts = this.db.prepare("INSERT INTO fts_chunks(rowid, title, content) VALUES (?, ?, ?)");
      const relation = this.db.prepare("INSERT INTO relationships VALUES (?, ?, ?, ?, ?, ?)");
      for (const entry of entries) {
        const props = entry.note.logicalProperties;
        const id = entry.note.kind === "managed" ? (props?.id as string) : null;
        const noteTitle = title(entry);
        const sensitivity = id ? (props?.sensitivity as string) : "private";
        const agentAccess = id ? (props?.agent_access as string) : "denied";
        if (id)
          entity.run(
            id,
            entry.path,
            props?.type,
            props?.status,
            noteTitle,
            JSON.stringify(props?.aliases ?? []),
            sensitivity,
            agentAccess,
          );
        file.run(entry.path, entry.note.hash, entry.note.kind, id);
        document.run(entry.path, id, noteTitle, sensitivity, agentAccess);
        const content = entry.note.bodyBytes.toString("utf8");
        const result = chunk.run(entry.path, content);
        fts.run(result.lastInsertRowid, noteTitle, content);
      }
      for (const entry of entries) {
        if (entry.note.kind !== "managed") continue;
        const props = entry.note.logicalProperties ?? {};
        for (const property of Object.keys(relationTargets) as (keyof typeof relationTargets)[]) {
          const values = Array.isArray(props[property])
            ? (props[property] as unknown[])
            : props[property]
              ? [props[property]]
              : [];
          for (const [ordinal, value] of values.entries()) {
            if (typeof value !== "string") continue;
            const target = resolveTarget(value, entries, relationTargets[property]);
            relation.run(props.id, property, ordinal, value, target.id, target.resolution);
          }
        }
      }
      this.db
        .prepare("INSERT INTO index_metadata VALUES ('revision', ?), ('vault_id', ?), ('vault_fingerprint', ?)")
        .run(next, input.vaultId, input.vaultFingerprint);
    })();
    return next;
  }

  search(query: string): SearchHit[] {
    if (!/[\p{L}\p{N}]/u.test(query)) return [];
    const literal = `"${query.replaceAll('"', '""')}"`;
    return this.db
      .prepare(`SELECT d.path, d.entity_id AS entityId, d.title
      FROM fts_chunks f JOIN chunks c ON c.id = f.rowid JOIN documents d ON d.path = c.path
      WHERE fts_chunks MATCH ? ORDER BY bm25(fts_chunks), d.path`)
      .all(literal) as SearchHit[];
  }

  close(): void {
    this.db.close();
  }
}

export function inspectIndex(
  databasePath: string,
  expectedRevision: string,
): "current" | "stale" | "missing" | "invalid" {
  if (!existsSync(databasePath)) return "missing";
  try {
    const db = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      if (db.pragma("user_version", { simple: true }) !== migrations.length) return "invalid";
      if (db.pragma("quick_check", { simple: true }) !== "ok") return "invalid";
      if (!hasRequiredSchema(db)) return "invalid";
      if (db.prepare(unfinishedTransaction).get()) return "invalid";
      const row = db.prepare("SELECT value FROM index_metadata WHERE key = 'revision'").get() as
        | { value?: string }
        | undefined;
      return row?.value === expectedRevision ? "current" : "stale";
    } finally {
      db.close();
    }
  } catch {
    return "invalid";
  }
}
