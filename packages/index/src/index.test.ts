import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashRaw, scanVault } from "@ideomy/vault-io";
import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { BetterSqliteStore, indexFilename, indexRevision, inspectIndex, relationTargets } from "./index.ts";
import { migrations } from "./migrations.ts";

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
    "# Исследование\nРусский полнотекстовый поиск. English knowledge retrieval. C++ project-plan can't trailing OR.\n",
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
      expect(store.version).toBe(3);
      const first = store.rebuild(f.input);
      expect(store.rebuild(f.input)).toBe(first);
      expect(inspectIndex(f.databasePath, first)).toBe("current");
      expect(store.search("русский")).toEqual([expect.objectContaining({ path: "Search.md", entityId: null })]);
      expect(store.search("knowledge")).toContainEqual(expect.objectContaining({ path: "Search.md" }));
      for (const query of ["C++", "project-plan", "can't", "trailing OR"])
        expect(store.search(query)).toContainEqual(expect.objectContaining({ path: "Search.md" }));
      expect(store.search('"unmatched')).toEqual([]);
      expect(store.search("++")).toEqual([]);
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
      expect(reopened.version).toBe(3);
    } finally {
      reopened.close();
    }
    const future = new Database(f.databasePath);
    future.pragma("user_version = 4");
    future.close();
    expect(() => new BetterSqliteStore(f.databasePath)).toThrowError(expect.objectContaining({ code: "INDEX-002" }));
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("looks up normalized names without hiding collisions and indexes resolved wikilinks", () => {
  const f = syntheticVault();
  try {
    const projectFile = path.join(f.vaultRoot, project);
    writeFileSync(projectFile, `${readFileSync(projectFile, "utf8")}\n[[Technology & AI]]\n[[Missing link]]\n`);
    const areaFile = path.join(f.vaultRoot, area);
    writeFileSync(
      areaFile,
      readFileSync(areaFile, "utf8").replace("status: active", 'status: active\naliases: ["Research alias"]'),
    );
    const store = new BetterSqliteStore(f.databasePath);
    try {
      store.rebuild(f.input);
      expect(store.lookupExact(projectId)).toMatchObject({ status: "found", note: { path: project } });
      expect(store.lookupExact("BUILD IDEOMY V1")).toMatchObject({ status: "found", note: { path: project } });
      expect(store.lookupExact("research alias")).toMatchObject({ status: "found", note: { path: area } });
      writeFileSync(path.join(f.vaultRoot, "Café.md"), "# Café\n");
      store.rebuild(f.input);
      expect(store.lookupExact("CAFE\u0301")).toMatchObject({ status: "found", note: { path: "Café.md" } });
      expect(store.lookupExact("missing")).toEqual({ status: "missing" });
      expect(store.edges()).toContainEqual(
        expect.objectContaining({ kind: "wiki", sourcePath: project, targetPath: area }),
      );
      const unmanaged = path.join(f.vaultRoot, "Other/Collision.md");
      mkdirSync(path.dirname(unmanaged), { recursive: true });
      writeFileSync(unmanaged, '---\naliases: ["Research alias"]\n---\n# Synthetic unmanaged\n');
      store.rebuild(f.input);
      expect(store.lookupExact("RESEARCH ALIAS")).toMatchObject({
        status: "ambiguous",
        candidates: [{ path: area }, { path: "Other/Collision.md" }],
      });
      expect(store.lookupExact(projectId)).toMatchObject({ status: "found", note: { path: project } });
    } finally {
      store.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("matches canonical Unicode in FTS and scores accent-folded title matches above body matches", () => {
  const f = syntheticVault();
  try {
    writeFileSync(path.join(f.vaultRoot, "Hangul.md"), "# 가\n나\n");
    writeFileSync(path.join(f.vaultRoot, "Résumé.md"), "# Résumé\n");
    writeFileSync(path.join(f.vaultRoot, "Body.md"), "# Body\nresume\n");
    const store = new BetterSqliteStore(f.databasePath);
    try {
      store.rebuild(f.input);
      expect(store.search("가")).toContainEqual(expect.objectContaining({ path: "Hangul.md" }));
      expect(store.search("가")).toContainEqual(expect.objectContaining({ path: "Hangul.md" }));
      expect(store.searchTerms("나")).toContainEqual(expect.objectContaining({ path: "Hangul.md", lexicalScore: 1 }));
      expect(store.searchTerms("resume", "or")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "Résumé.md", lexicalScore: 5 }),
          expect.objectContaining({ path: "Body.md", lexicalScore: 1 }),
        ]),
      );
      expect(store.searchTerms("resume absent", "or")).toEqual(store.searchTerms("resume", "or"));
    } finally {
      store.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("upgrades the disposable v1 index and fails closed on ambiguous wikilinks", () => {
  const f = syntheticVault();
  try {
    mkdirSync(path.dirname(f.databasePath), { recursive: true });
    const old = new Database(f.databasePath);
    old.exec(migrations[0]);
    old.pragma("user_version = 1");
    old.close();
    const projectFile = path.join(f.vaultRoot, project);
    const original = readFileSync(projectFile, "utf8");
    writeFileSync(projectFile, `${original}\n[[Technology & AI]]\n`);
    const collision = path.join(f.vaultRoot, "Other/Technology & AI.md");
    mkdirSync(path.dirname(collision), { recursive: true });
    writeFileSync(collision, "# Synthetic unmanaged\n");
    const store = new BetterSqliteStore(f.databasePath);
    try {
      expect(store.version).toBe(3);
      const revision = store.rebuild(f.input);
      expect(inspectIndex(f.databasePath, revision)).toBe("current");
      expect(store.edges().some((edge) => edge.kind === "wiki" && edge.sourcePath === project)).toBe(false);
      const db = new Database(f.databasePath, { readonly: true });
      try {
        expect(db.prepare("SELECT resolution FROM wiki_links WHERE source_path = ?").get(project)).toEqual({
          resolution: "ambiguous",
        });
      } finally {
        db.close();
      }
      writeFileSync(projectFile, `${original}\n[[00 System/Areas/Technology & AI]]\n`);
      store.rebuild(f.input);
      expect(store.edges()).toContainEqual(
        expect.objectContaining({ kind: "wiki", sourcePath: project, targetPath: area }),
      );
    } finally {
      store.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("keeps relationship targets within the machine contract's entity type", () => {
  const artifact = JSON.parse(readFileSync(path.join(fixtures, "../../schemas/relationships.json"), "utf8")) as Record<
    string,
    { to: string[] }
  >;
  expect(Object.fromEntries(Object.entries(artifact).map(([name, rule]) => [name, rule.to[0]]))).toEqual(
    relationTargets,
  );
  const f = syntheticVault();
  try {
    const personFile = path.join(f.vaultRoot, "30 People/Alex Example.md");
    mkdirSync(path.dirname(personFile), { recursive: true });
    copyFileSync(path.join(fixtures, "30 People/Alex Example.md"), personFile);
    const projectFile = path.join(f.vaultRoot, project);
    const original = readFileSync(projectFile, "utf8");
    writeFileSync(
      projectFile,
      original.replace('primary_area: "[[Technology & AI]]"', 'primary_area: "[[Alex Example]]"'),
    );
    const store = new BetterSqliteStore(f.databasePath);
    try {
      store.rebuild(f.input);
      const db = new Database(f.databasePath, { readonly: true });
      try {
        expect(
          db
            .prepare(
              "SELECT target_id, resolution FROM relationships WHERE source_id = ? AND property = 'primary_area'",
            )
            .get(projectId),
        ).toEqual({ target_id: null, resolution: "missing" });
      } finally {
        db.close();
      }
      writeFileSync(projectFile, original);
      writeFileSync(personFile, readFileSync(personFile, "utf8").replace("# Alex Example", "# Technology & AI"));
      store.rebuild(f.input);
      const resolved = new Database(f.databasePath, { readonly: true });
      try {
        expect(
          resolved
            .prepare(
              "SELECT target_id, resolution FROM relationships WHERE source_id = ? AND property = 'primary_area'",
            )
            .get(projectId),
        ).toEqual({ target_id: null, resolution: "ambiguous" });
      } finally {
        resolved.close();
      }
      const areaFile = path.join(f.vaultRoot, area);
      writeFileSync(
        areaFile,
        readFileSync(areaFile, "utf8").replace("status: active", 'status: active\naliases: ["30 People/Alex Example"]'),
      );
      writeFileSync(
        projectFile,
        original.replace('primary_area: "[[Technology & AI]]"', 'primary_area: "[[30 People/Alex Example]]"'),
      );
      store.rebuild(f.input);
      const exactPath = new Database(f.databasePath, { readonly: true });
      try {
        expect(
          exactPath
            .prepare(
              "SELECT target_id, resolution FROM relationships WHERE source_id = ? AND property = 'primary_area'",
            )
            .get(projectId),
        ).toEqual({ target_id: null, resolution: "missing" });
      } finally {
        exactPath.close();
      }
    } finally {
      store.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("resolves at the first matching tier before type checks and includes unmanaged collisions", () => {
  const f = syntheticVault();
  try {
    const projectFile = path.join(f.vaultRoot, project);
    const original = readFileSync(projectFile, "utf8");
    const areaFile = path.join(f.vaultRoot, area);
    const areaOriginal = readFileSync(areaFile, "utf8");
    const unmanagedFile = path.join(f.vaultRoot, "Other/Technology & AI.md");
    mkdirSync(path.dirname(unmanagedFile), { recursive: true });
    writeFileSync(unmanagedFile, "# Synthetic unmanaged\n");
    const store = new BetterSqliteStore(f.databasePath);
    const relation = () => {
      const db = new Database(f.databasePath, { readonly: true });
      try {
        return db
          .prepare("SELECT target_id, resolution FROM relationships WHERE source_id = ? AND property = 'primary_area'")
          .get(projectId);
      } finally {
        db.close();
      }
    };
    try {
      store.rebuild(f.input);
      expect(relation()).toEqual({ target_id: null, resolution: "ambiguous" });

      renameSync(unmanagedFile, path.join(f.vaultRoot, "Other/Unmanaged.md"));
      writeFileSync(path.join(f.vaultRoot, "Other/Unmanaged.md"), "# Technology & AI\n");
      store.rebuild(f.input);
      expect(relation()).toEqual({ target_id: null, resolution: "ambiguous" });
      renameSync(path.join(f.vaultRoot, "Other/Unmanaged.md"), unmanagedFile);

      writeFileSync(projectFile, original.replace("[[Technology & AI]]", "[[Other/Technology & AI]]"));
      writeFileSync(
        areaFile,
        areaOriginal.replace("status: active", 'status: active\naliases: ["Other/Technology & AI"]'),
      );
      store.rebuild(f.input);
      expect(relation()).toEqual({ target_id: null, resolution: "missing" });

      writeFileSync(projectFile, original.replace("[[Technology & AI]]", "[[Shared alias]]"));
      writeFileSync(areaFile, areaOriginal.replace("status: active", 'status: active\naliases: ["Shared alias"]'));
      writeFileSync(unmanagedFile, '---\naliases: ["Shared alias"]\n---\n# Synthetic unmanaged\n');
      store.rebuild(f.input);
      expect(relation()).toEqual({ target_id: null, resolution: "ambiguous" });

      for (const aliases of ['"Shared alias extra"', "{ user: value }"]) {
        writeFileSync(unmanagedFile, `---\naliases: ${aliases}\n---\n# Synthetic unmanaged\n`);
        store.rebuild(f.input);
        expect(relation()).toMatchObject({ resolution: "resolved", target_id: expect.stringMatching(/^area_/) });
      }
    } finally {
      store.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("marks pre-decision index revisions stale and rebuilds edges without changing Markdown", () => {
  const f = syntheticVault();
  try {
    const collision = path.join(f.vaultRoot, "Other/Technology & AI.md");
    mkdirSync(path.dirname(collision), { recursive: true });
    writeFileSync(collision, "# Synthetic unmanaged\n");
    const source = path.join(f.vaultRoot, project);
    const before = readFileSync(source);
    const store = new BetterSqliteStore(f.databasePath);
    try {
      const notes = scanVault(f.vaultRoot).notes;
      const oldRevision = hashRaw(
        Buffer.from(
          JSON.stringify({
            vaultId: f.input.vaultId,
            vaultFingerprint: f.input.vaultFingerprint,
            mapping: {},
            files: notes.map(({ path: file, note }) => [file, note.hash]),
          }),
        ),
      );
      const currentRevision = indexRevision(notes, f.input);
      expect(currentRevision).not.toBe(oldRevision);
      store.rebuild(f.input);
      const old = new Database(f.databasePath);
      old.prepare("UPDATE index_metadata SET value = ? WHERE key = 'revision'").run(oldRevision);
      const areaId = (old.prepare("SELECT id FROM entities WHERE type = 'area'").get() as { id: string }).id;
      old
        .prepare(
          "UPDATE relationships SET target_id = ?, resolution = 'resolved' WHERE source_id = ? AND property = 'primary_area'",
        )
        .run(areaId, projectId);
      old.close();
      expect(inspectIndex(f.databasePath, currentRevision)).toBe("stale");
      store.rebuild(f.input);
      expect(inspectIndex(f.databasePath, currentRevision)).toBe("current");
      const rebuilt = new Database(f.databasePath, { readonly: true });
      try {
        expect(
          rebuilt
            .prepare(
              "SELECT target_id, resolution FROM relationships WHERE source_id = ? AND property = 'primary_area'",
            )
            .get(projectId),
        ).toEqual({ target_id: null, resolution: "ambiguous" });
      } finally {
        rebuilt.close();
      }
      expect(readFileSync(source)).toEqual(before);
    } finally {
      store.close();
    }
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
    const reopened = new BetterSqliteStore(f.databasePath);
    try {
      expect(inspectIndex(f.databasePath, reopened.revision() ?? "")).toBe("invalid");
      expect(() => reopened.rebuild(f.input)).toThrowError(expect.objectContaining({ code: "INDEX-004" }));
      writeFileSync(path.join(f.vaultRoot, "Search.md"), "changed synthetic content");
      expect(() => reopened.rebuild(f.input)).toThrowError(expect.objectContaining({ code: "INDEX-004" }));
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

it("reports an incomplete FTS schema instead of a current cached revision", () => {
  const f = syntheticVault();
  try {
    const store = new BetterSqliteStore(f.databasePath);
    const revision = store.rebuild(f.input);
    store.close();
    const db = new Database(f.databasePath);
    db.exec("DROP TABLE fts_chunks");
    db.close();
    expect(inspectIndex(f.databasePath, revision)).toBe("invalid");
    const wrongShape = new Database(f.databasePath);
    wrongShape.exec("CREATE VIRTUAL TABLE fts_chunks USING fts5(title)");
    wrongShape.close();
    expect(inspectIndex(f.databasePath, revision)).toBe("invalid");
    expect(() => new BetterSqliteStore(f.databasePath)).toThrowError(expect.objectContaining({ code: "INDEX-003" }));
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
