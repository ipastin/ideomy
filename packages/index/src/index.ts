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
  "wiki_links",
  "documents",
  "chunks",
  "fts_chunks",
  "transactions",
] as const;

function hasRequiredSchema(db: Database.Database): boolean {
  const rows = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table'").all() as {
    name: string;
    sql: string | null;
  }[];
  const tables = new Map(rows.map((row) => [row.name, row.sql]));
  const ftsColumns = db.prepare("PRAGMA table_xinfo(fts_chunks)").all() as { name: string }[];
  const wikiColumns = db.prepare("PRAGMA table_info(wiki_links)").all() as { name: string }[];
  return (
    requiredTables.every((name) => tables.has(name)) &&
    /^CREATE VIRTUAL TABLE[\s\S]*\bUSING\s+fts5\b/i.test(tables.get("fts_chunks") ?? "") &&
    ["title", "content"].every((name) => ftsColumns.some((column) => column.name === name)) &&
    ["source_path", "target_path", "resolution"].every((name) => wikiColumns.some((column) => column.name === name)) &&
    ["aliases", "activity_at"].every((name) =>
      (db.prepare("PRAGMA table_info(documents)").all() as { name: string }[]).some((column) => column.name === name),
    ) &&
    (db.prepare("PRAGMA table_info(documents)").all() as { name: string }[]).some(
      (column) => column.name === "capture_marker",
    )
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
  searchTerms(query: string, operator?: "and" | "or"): TermSearchHit[];
  notes(): IndexedNote[];
  lookupExact(query: string): LookupResult;
  edges(): IndexedEdge[];
  readAllowedContent(path: string, vaultFingerprint: string): string | null;
  vaultFingerprint(): string | null;
  close(): void;
}

export type IndexInput = {
  vaultRoot: string;
  vaultId: string;
  vaultFingerprint: string;
  propertyMapping?: Record<string, string>;
};

export type SearchHit = { path: string; entityId: string | null; title: string };
export type TermSearchHit = SearchHit & { lexicalScore: number };
export type IndexedNote = SearchHit & {
  basename: string;
  aliases: string[];
  type: string | null;
  status: string | null;
  hash: string;
  sensitivity: string;
  agentAccess: string;
  activityAt: string | null;
  kind: "managed" | "unmanaged";
  captureMarker: string | null;
};
export type IndexedEdge = {
  kind: "typed" | "wiki";
  sourcePath: string;
  targetPath: string;
  property: string | null;
  ordinal: number;
};
export type LookupResult =
  | { status: "missing" }
  | { status: "found"; note: IndexedNote }
  | { status: "ambiguous"; candidates: IndexedNote[] };
export const indexFilename = "structured-index.sqlite";
const relationResolutionVersion = 2;
const graphIndexVersion = 1;
const scopedRetrievalIndexVersion = 2;

type Entry = { path: string; note: ParsedNote };

function title(entry: Entry): string {
  return entry.note.structure.headings[0]?.text || path.basename(entry.path, ".md");
}

export function indexRevision(entries: Entry[], input: IndexInput): string {
  return hashRaw(
    Buffer.from(
      JSON.stringify({
        relationResolutionVersion,
        graphIndexVersion,
        scopedRetrievalIndexVersion,
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

function resolveReference(reference: string, entries: Entry[]): { entry: Entry | null; resolution: string } {
  const name = reference.split("#", 1)[0]?.replace(/\.md$/i, "") ?? "";
  const candidates = [
    entries.filter((entry) => entry.path.replace(/\.md$/i, "") === name),
    entries.filter((entry) => path.basename(entry.path, ".md") === name || title(entry) === name),
    entries.filter((entry) => {
      const aliases = entry.note.logicalProperties?.aliases;
      return Array.isArray(aliases) && aliases.includes(name);
    }),
  ];
  for (const matches of candidates) {
    if (!matches.length) continue;
    if (matches.length !== 1) return { entry: null, resolution: "ambiguous" };
    return { entry: matches[0] ?? null, resolution: "resolved" };
  }
  return { entry: null, resolution: "missing" };
}

function resolveTarget(
  target: string,
  entries: Entry[],
  targetType: string,
): { id: string | null; resolution: string } {
  const reference = target.slice(2, -2).split("|", 1)[0] ?? "";
  const match = resolveReference(reference, entries);
  if (match.resolution !== "resolved") return { id: null, resolution: match.resolution };
  if (match.entry?.note.kind !== "managed" || match.entry.note.logicalProperties?.type !== targetType)
    return { id: null, resolution: "missing" };
  return { id: match.entry.note.logicalProperties.id as string, resolution: "resolved" };
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
        "DELETE FROM fts_chunks; DELETE FROM chunks; DELETE FROM relationships; DELETE FROM wiki_links; DELETE FROM file_state; DELETE FROM documents; DELETE FROM entities; DELETE FROM index_metadata;",
      );
      const entity = this.db.prepare("INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const file = this.db.prepare("INSERT INTO file_state VALUES (?, ?, ?, ?)");
      const document = this.db.prepare(
        "INSERT INTO documents(path, entity_id, title, sensitivity, agent_access, aliases, activity_at, capture_marker) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      const chunk = this.db.prepare("INSERT INTO chunks(path, ordinal, content) VALUES (?, 0, ?)");
      const fts = this.db.prepare("INSERT INTO fts_chunks(rowid, title, content) VALUES (?, ?, ?)");
      const relation = this.db.prepare("INSERT INTO relationships VALUES (?, ?, ?, ?, ?, ?)");
      const wiki = this.db.prepare("INSERT INTO wiki_links VALUES (?, ?, ?, ?, ?)");
      for (const entry of entries) {
        const props = entry.note.logicalProperties;
        const aliases = Array.isArray(props?.aliases)
          ? props.aliases.filter((value): value is string => typeof value === "string")
          : [];
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
            JSON.stringify(aliases),
            sensitivity,
            agentAccess,
          );
        file.run(entry.path, entry.note.hash, entry.note.kind, id);
        const activityAt = props?.date ?? props?.updated ?? props?.created;
        document.run(
          entry.path,
          id,
          noteTitle,
          sensitivity,
          agentAccess,
          JSON.stringify(aliases),
          typeof activityAt === "string" ? activityAt : null,
          props?.ideomy_capture === "web-v1" && props.capture_type === "web" && props.capture_status === "inbox"
            ? "web-v1"
            : null,
        );
        const content = entry.note.bodyBytes.toString("utf8");
        const result = chunk.run(entry.path, content);
        fts.run(result.lastInsertRowid, noteTitle.normalize("NFC"), content.normalize("NFC"));
      }
      for (const entry of entries) {
        for (const [ordinal, link] of entry.note.structure.links.entries()) {
          if (link.kind !== "wiki" || link.embed) continue;
          const match = resolveReference(link.target, entries);
          wiki.run(entry.path, ordinal, link.target, match.entry?.path ?? null, match.resolution);
        }
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
    const literal = `"${query.normalize("NFC").replaceAll('"', '""')}"`;
    return this.db
      .prepare(`SELECT d.path, d.entity_id AS entityId, d.title
      FROM fts_chunks f JOIN chunks c ON c.id = f.rowid JOIN documents d ON d.path = c.path
      WHERE fts_chunks MATCH ? ORDER BY bm25(fts_chunks), d.path`)
      .all(literal) as SearchHit[];
  }

  searchTerms(query: string, operator: "and" | "or" = "and"): TermSearchHit[] {
    const terms = [
      ...new Set(
        query
          .normalize("NFC")
          .toLowerCase()
          .match(/[\p{L}\p{N}]+/gu) ?? [],
      ),
    ];
    if (!terms.length) return [];
    const statement = this.db.prepare(`SELECT f.rowid, d.path, d.entity_id AS entityId, d.title
      FROM fts_chunks f JOIN chunks c ON c.id = f.rowid JOIN documents d ON d.path = c.path
      WHERE fts_chunks MATCH ? ORDER BY d.path`);
    const expression = terms
      .map((term) => `"${term.replaceAll('"', '""')}"`)
      .join(operator === "and" ? " AND " : " OR ");
    const rows = statement.all(expression) as (SearchHit & { rowid: number })[];
    const columnMatches = this.db.prepare("SELECT rowid FROM fts_chunks WHERE fts_chunks MATCH ?");
    const matches = terms.map((term) =>
      (["title", "content"] as const).map(
        (column) =>
          new Set(
            (columnMatches.all(`${column} : "${term.replaceAll('"', '""')}"`) as { rowid: number }[]).map(
              (row) => row.rowid,
            ),
          ),
      ),
    );
    return rows.map(({ rowid, ...hit }) => {
      const lexicalScore = matches.reduce(
        (score, [title, content]) => score + (title?.has(rowid) ? 5 : content?.has(rowid) ? 1 : 0),
        0,
      );
      return { ...hit, lexicalScore };
    });
  }

  notes(): IndexedNote[] {
    const rows = this.db
      .prepare(`SELECT d.path, d.entity_id AS entityId, d.title, d.aliases,
      e.type, e.status, f.hash, f.kind, d.sensitivity, d.agent_access AS agentAccess,
      d.activity_at AS activityAt, d.capture_marker AS captureMarker
      FROM documents d JOIN file_state f ON f.path = d.path
      LEFT JOIN entities e ON e.id = d.entity_id ORDER BY d.path`)
      .all() as (Omit<IndexedNote, "basename" | "aliases"> & { aliases: string })[];
    return rows.map((row) => ({
      ...row,
      basename: path.basename(row.path, ".md"),
      aliases: JSON.parse(row.aliases) as string[],
    }));
  }

  lookupExact(query: string): LookupResult {
    const notes = this.notes();
    const byId = notes.find((note) => note.entityId === query);
    if (byId) return { status: "found", note: byId };
    const normalized = query.normalize("NFC").toLowerCase();
    if (!normalized) return { status: "missing" };
    // shortcut: scan metadata for exact names; add a term index if Vault-scale lookup latency warrants it.
    const candidates = notes.filter((note) =>
      [note.title, note.basename, ...note.aliases].some((value) => value.normalize("NFC").toLowerCase() === normalized),
    );
    const first = candidates[0];
    if (!first) return { status: "missing" };
    return candidates.length === 1 ? { status: "found", note: first } : { status: "ambiguous", candidates };
  }

  edges(): IndexedEdge[] {
    const typed = this.db
      .prepare(`SELECT 'typed' AS kind, source.path AS sourcePath, target.path AS targetPath,
      r.property, r.ordinal FROM relationships r
      JOIN entities source ON source.id = r.source_id
      JOIN entities target ON target.id = r.target_id WHERE r.resolution = 'resolved'`)
      .all() as IndexedEdge[];
    const wiki = this.db
      .prepare(`SELECT 'wiki' AS kind, source_path AS sourcePath,
      target_path AS targetPath, NULL AS property, ordinal FROM wiki_links
      WHERE resolution = 'resolved' AND target_path IS NOT NULL`)
      .all() as IndexedEdge[];
    return [...typed, ...wiki];
  }

  vaultFingerprint(): string | null {
    return (
      (
        this.db.prepare("SELECT value FROM index_metadata WHERE key = 'vault_fingerprint'").get() as
          | { value: string }
          | undefined
      )?.value ?? null
    );
  }

  readAllowedContent(notePath: string, vaultFingerprint: string): string | null {
    if (!vaultFingerprint || this.vaultFingerprint() !== vaultFingerprint)
      throw new IndexError("INDEX-005", "Wrong Vault fingerprint.");
    return (
      (
        this.db
          .prepare(`SELECT c.content FROM chunks c JOIN documents d ON d.path = c.path
      WHERE c.path = ? AND d.agent_access = 'allowed'
      AND d.sensitivity IN ('public', 'internal', 'private') ORDER BY c.ordinal LIMIT 1`)
          .get(notePath) as { content: string } | undefined
      )?.content ?? null
    );
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
