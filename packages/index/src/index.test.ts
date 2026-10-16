import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { BetterSqliteStore, indexFilename, inspectIndex } from "./index.ts";

const fixtures = path.resolve(import.meta.dirname, "../../../fixtures/test-vault");
const project = "10 Projects/Build Ideomy v1.md";
const area = "00 System/Areas/Technology & AI.md";
const goal = "11 Goals/Build Reliable Personal Knowledge System.md";
const projectId = "prj_01M4K11NG0XKJFG87XA758PBH3";

function syntheticVault() {
  const directory = mkdtempSync(path.join(tmpdir(), "ideomy-structured-index-"));
  const vaultRoot = path.join(directory, "vault");
  const databasePath = path.join(directory, "state", indexFilename);
  mkdirSync(vaultRoot);
  for (const file of [project, area, goal]) {
    mkdirSync(path.dirname(path.join(vaultRoot, file)), { recursive: true });
    copyFileSync(path.join(fixtures, file), path.join(vaultRoot, file));
  }
  writeFileSync(
    path.join(vaultRoot, "Search.md"),
    "# Исследование\nРусский полнотекстовый поиск. English knowledge retrieval.\n",
  );
  return {
    directory,
    vaultRoot,
    databasePath,
    input: { vaultRoot, vaultId: "synthetic", vaultFingerprint: "synthetic-fingerprint" },
  };
}

it("migrates, rebuilds deterministically, resolves relations, and searches Russian and English", () => {
  const f = syntheticVault();
  try {
    const before = readFileSync(path.join(f.vaultRoot, project));
    const store = new BetterSqliteStore(f.databasePath);
    try {
      expect(store.version).toBe(1);
      const first = store.rebuild(f.input);
      expect(store.rebuild(f.input)).toBe(first);
      expect(inspectIndex(f.databasePath, first)).toBe("current");
      expect(store.search("русский")).toEqual([expect.objectContaining({ path: "Search.md", entityId: null })]);
      expect(store.search("knowledge")).toContainEqual(expect.objectContaining({ path: "Search.md" }));
      expect(store.search("несуществующее")).toEqual([]);
      const db = new Database(f.databasePath, { readonly: true });
      try {
        expect((db.prepare("SELECT count(*) AS n FROM file_state").get() as { n: number }).n).toBe(4);
        expect((db.prepare("SELECT count(*) AS n FROM documents").get() as { n: number }).n).toBe(4);
        expect((db.prepare("SELECT count(*) AS n FROM chunks").get() as { n: number }).n).toBe(4);
        expect(
          db
            .prepare(
              "SELECT target_id, resolution FROM relationships WHERE source_id = ? AND property = 'primary_area'",
            )
            .get(projectId),
        ).toMatchObject({ resolution: "resolved", target_id: expect.stringMatching(/^area_/) });
        expect((db.prepare("SELECT count(*) AS n FROM transactions").get() as { n: number }).n).toBe(0);
      } finally {
        db.close();
      }
    } finally {
      store.close();
    }
    expect(readFileSync(path.join(f.vaultRoot, project))).toEqual(before);
    const reopened = new BetterSqliteStore(f.databasePath);
    try {
      expect(reopened.version).toBe(1);
    } finally {
      reopened.close();
    }
    const future = new Database(f.databasePath);
    future.pragma("user_version = 2");
    future.close();
    expect(() => new BetterSqliteStore(f.databasePath)).toThrowError(expect.objectContaining({ code: "INDEX-002" }));
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("keeps entity identity across rename and reconciles deletion from observed files", () => {
  const f = syntheticVault();
  try {
    const store = new BetterSqliteStore(f.databasePath);
    try {
      store.rebuild(f.input);
      mkdirSync(path.join(f.vaultRoot, "Moved"));
      renameSync(path.join(f.vaultRoot, project), path.join(f.vaultRoot, "Moved/renamed.md"));
      rmSync(path.join(f.vaultRoot, area));
      store.rebuild(f.input);
      const db = new Database(f.databasePath, { readonly: true });
      try {
        expect(db.prepare("SELECT id, path FROM entities WHERE id = ?").get(projectId)).toEqual({
          id: projectId,
          path: "Moved/renamed.md",
        });
        expect(db.prepare("SELECT id FROM entities WHERE type = 'area'").get()).toBeUndefined();
        expect(
          db
            .prepare("SELECT resolution FROM relationships WHERE source_id = ? AND property = 'primary_area'")
            .get(projectId),
        ).toEqual({ resolution: "missing" });
      } finally {
        db.close();
      }
    } finally {
      store.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("fails closed on duplicate IDs and preserves unfinished recovery metadata", () => {
  const f = syntheticVault();
  try {
    const store = new BetterSqliteStore(f.databasePath);
    try {
      const good = store.rebuild(f.input);
      copyFileSync(path.join(f.vaultRoot, project), path.join(f.vaultRoot, "duplicate.md"));
      expect(() => store.rebuild(f.input)).toThrowError(expect.objectContaining({ code: "SCHEMA-104" }));
      expect(store.revision()).toBe(good);
      rmSync(path.join(f.vaultRoot, "duplicate.md"));
    } finally {
      store.close();
    }
    const db = new Database(f.databasePath);
    db.prepare(
      "INSERT INTO transactions VALUES ('synthetic-operation', 'prepared', 'synthetic-journal', '2026-10-16T00:00:00Z')",
    ).run();
    db.close();
    writeFileSync(path.join(f.vaultRoot, "Search.md"), "changed synthetic content");
    const reopened = new BetterSqliteStore(f.databasePath);
    try {
      expect(() => reopened.rebuild(f.input)).toThrowError(expect.objectContaining({ code: "INDEX-004" }));
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
