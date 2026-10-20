import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { traverseProject } from "@ideomy/graph";
import { BetterSqliteStore } from "@ideomy/index";
import { expect, it } from "vitest";
import { buildProjectContextPack, projectSections } from "./index.ts";

const fixtures = path.resolve(import.meta.dirname, "../../../fixtures/test-vault");
const project = "10 Projects/Build Ideomy v1.md";
const projectId = "prj_01M4K11NG0XKJFG87XA758PBH3";
const knowledge = "20 Knowledge/Primary Area Is Determined by Intent.md";
const decision = "40 Decisions/2026-10-03 — Use External Personal Vault.md";
const localOnly = "20 Knowledge/Private Local Only.md";
const restrictedPerson = "30 People/Alex Example.md";

it("builds a bounded Project Pack from incoming links with provenance and access filtering", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ideomy-project-pack-"));
  const vaultRoot = path.join(directory, "vault");
  const databasePath = path.join(directory, "index.sqlite");
  const files = [
    project,
    "00 System/Areas/Technology & AI.md",
    "11 Goals/Build Reliable Personal Knowledge System.md",
    knowledge,
    decision,
    localOnly,
    restrictedPerson,
  ];
  try {
    for (const file of files) {
      const destination = path.join(vaultRoot, file);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(path.join(fixtures, file), destination);
    }
    const projectFile = path.join(vaultRoot, project);
    writeFileSync(
      projectFile,
      `${readFileSync(projectFile, "utf8")}\n[[Private Local Only]]\n[[Unmanaged Existing Note]]\n`,
    );
    const unmanaged = "20 Knowledge/Unmanaged Existing Note.md";
    copyFileSync(path.join(fixtures, unmanaged), path.join(vaultRoot, unmanaged));
    const seed = readFileSync(path.join(fixtures, knowledge), "utf8")
      .replace("kn_01M4K11NG0P7VQFQ3Z69M6XACE", "kn_01M4K11NG0P7VQFQ3Z69M6XACF")
      .replace("status: evergreen", "status: seed")
      .replaceAll("Primary Area Is Determined by Intent", "Secondary Knowledge");
    writeFileSync(path.join(vaultRoot, "20 Knowledge/Secondary Knowledge.md"), seed);
    for (const suffix of ["C", "D", "E", "F", "G", "H", "J"])
      writeFileSync(
        path.join(vaultRoot, `40 Decisions/Synthetic Decision ${suffix}.md`),
        readFileSync(path.join(fixtures, decision), "utf8")
          .replace("dec_01M4K11NG0VEB0JAS3F501V9XB", `dec_01M4K11NG0VEB0JAS3F501V9X${suffix}`)
          .replaceAll("Use External Personal Vault", `Synthetic Decision ${suffix}`),
      );
    const store = new BetterSqliteStore(databasePath);
    try {
      const input = { vaultRoot, vaultId: "synthetic", vaultFingerprint: "synthetic-fingerprint" };
      const revision = store.rebuild(input);
      const graph = traverseProject(store, projectId);
      expect(graph.nodes.map((note) => note.path)).toContain(decision);
      expect(graph.nodes.map((note) => note.path)).toContain(knowledge);
      expect(graph.nodes.map((note) => note.path)).toContain(unmanaged);
      expect(graph.edges.some((edge) => edge.kind === "wiki" && edge.targetPath === unmanaged)).toBe(true);
      expect(graph.truncated).toBe(false);
      const access = {
        purpose: "agent_context",
        vaultFingerprint: input.vaultFingerprint,
        expectedRevision: revision,
      } as const;
      const pack = buildProjectContextPack(store, projectId, access);
      expect(Object.keys(pack.sections)).toEqual(projectSections);
      expect(pack.sections.goal[0]?.text).toContain("working local-first Ideomy MVP");
      expect(pack.sections.recentDecisions[0]?.source).toMatchObject({
        entityId: "dec_01M4K11NG0VEB0JAS3F501V9XB",
        path: decision,
      });
      expect(pack.sections.relevantKnowledge.map((item) => item.source.path)).toEqual([
        knowledge,
        "20 Knowledge/Secondary Knowledge.md",
      ]);
      expect(pack.sections.people).toEqual([]);
      expect(JSON.stringify(pack)).not.toContain("Private Local Only");
      expect(JSON.stringify(pack)).not.toContain("Unmanaged Existing Note");
      expect(pack.indexRevision).toBe(revision);
      expect(pack.sections.relevantKnowledge[0]?.source.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(pack.sections.relevantKnowledge[0]?.trust).toBe("untrusted_data");
      expect(pack.omittedCount).toBeGreaterThan(0);
      expect(pack.truncated).toBe(true);
      expect(Object.values(pack.sections).flat()).toHaveLength(10);
      const golden = readFileSync(path.resolve(fixtures, "../../evals/golden/retrieval.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map(
          (line) =>
            JSON.parse(line) as {
              id: string;
              kind?: string;
              query?: string;
              expected_ids: string[];
              excluded_ids?: string[];
            },
        );
      for (const item of golden.filter((item) => item.kind === "exact_lookup"))
        expect(store.lookupExact(item.query ?? "")).toMatchObject({
          status: "found",
          note: { entityId: item.expected_ids[0] },
        });
      const projectGolden = golden.find((item) => item.id === "ret-009");
      if (!projectGolden) throw new Error("Project Pack golden case is missing.");
      const packedIds = Object.values(pack.sections)
        .flat()
        .map((item) => item.source.entityId);
      for (const id of projectGolden.expected_ids) expect(packedIds).toContain(id);
      for (const id of projectGolden.excluded_ids ?? []) expect(packedIds).not.toContain(id);
      expect(() => buildProjectContextPack(store, projectId, { ...access, vaultFingerprint: "wrong" })).toThrowError(
        expect.objectContaining({ code: "RETRIEVAL-001" }),
      );
      expect(() => buildProjectContextPack(store, projectId, { ...access, expectedRevision: "stale" })).toThrowError(
        expect.objectContaining({ code: "RETRIEVAL-002" }),
      );
    } finally {
      store.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("caps one-hop traversal and Pack text without cutting through Unicode code points", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ideomy-project-bounds-"));
  const vaultRoot = path.join(directory, "vault");
  try {
    for (const file of [project, knowledge]) {
      const destination = path.join(vaultRoot, file);
      mkdirSync(path.dirname(destination), { recursive: true });
      copyFileSync(path.join(fixtures, file), destination);
    }
    const projectFile = path.join(vaultRoot, project);
    const links = Array.from({ length: 60 }, (_, i) => `[[Synthetic ${String(i).padStart(2, "0")}]]`).join("\n");
    writeFileSync(projectFile, `${readFileSync(projectFile, "utf8")}\n${links}\n`);
    for (let i = 0; i < 60; i++)
      writeFileSync(
        path.join(vaultRoot, `Synthetic ${String(i).padStart(2, "0")}.md`),
        `# Synthetic ${String(i).padStart(2, "0")}\n`,
      );
    const knowledgeFile = path.join(vaultRoot, knowledge);
    writeFileSync(
      knowledgeFile,
      readFileSync(knowledgeFile, "utf8").replace(
        "Primary Area is determined by why the information exists, not by keywords.",
        "🧠".repeat(15_000),
      ),
    );
    const store = new BetterSqliteStore(path.join(directory, "index.sqlite"));
    try {
      const vaultFingerprint = "bounded-synthetic";
      const revision = store.rebuild({ vaultRoot, vaultId: "synthetic", vaultFingerprint });
      const graph = traverseProject(store, projectId);
      expect(graph.nodes).toHaveLength(50);
      expect(graph.truncated).toBe(true);
      const pack = buildProjectContextPack(store, projectId, {
        purpose: "agent_context",
        vaultFingerprint,
        expectedRevision: revision,
      });
      expect(pack.truncated).toBe(true);
      expect(
        Object.values(pack.sections)
          .flat()
          .reduce((sum, item) => sum + Array.from(item.text).length, 0),
      ).toBeLessThanOrEqual(12_000);
      expect(pack.sections.relevantKnowledge[0]?.text.endsWith("🧠")).toBe(true);
    } finally {
      store.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
