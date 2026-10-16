import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createVaultIdentity,
  deriveVaultFingerprint,
  extractMarkdownStructure,
  generateEntityId,
  hashRaw,
  normalizeProperties,
  parseMarkdown,
  planScalarPropertyChange,
  resolveVaultFile,
  scanVault,
  VaultError,
} from "./index.ts";
import { VaultWatcher } from "./watcher.ts";

const repo = path.resolve(import.meta.dirname, "../../..");
const fixtureRoot = path.join(repo, "fixtures/test-vault");
const project = readFileSync(path.join(fixtureRoot, "10 Projects/Build Ideomy v1.md"));

function withSyntheticVault<T>(run: (root: string) => T): T {
  const root = mkdtempSync(path.join(tmpdir(), "ideomy-vault-io-"));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("M0.2 Vault I/O", () => {
  it("parses every synthetic fixture and detects the intentional duplicate ID", () => {
    const result = scanVault(fixtureRoot);
    expect(result.notes).toHaveLength(36);
    expect(result.diagnostics.map((entry) => [entry.code, entry.path])).toEqual([
      ["SCHEMA-104", "10 Projects/Build Ideomy v1.md"],
      ["SCHEMA-104", "90 Archive/INVALID — Duplicate ID.md"],
    ]);
    expect(result.notes.find((entry) => entry.path.endsWith("Unmanaged Existing Note.md"))?.note.kind).toBe(
      "unmanaged",
    );
    expect(result.notes.filter((entry) => entry.note.kind === "invalid")).toHaveLength(2);
  });

  it("blocks ordinary scalar plans from changing user-owned properties", () => {
    const raw = Buffer.from(
      project.toString("utf8").replace("status: active", "status: active\ncustom_property: keep-me"),
    );
    const note = parseMarkdown(raw);
    expect(note.kind).toBe("managed");
    expect(() => planScalarPropertyChange(note, "custom_property", "changed")).toThrowError(
      expect.objectContaining({ code: "VAULT-108" }),
    );
    expect(planScalarPropertyChange(note, "status", "paused").candidate.toString()).toContain(
      "custom_property: keep-me",
    );
  });

  it("rejects an anchored managed scalar when a user property aliases it", () => {
    const raw = Buffer.from(
      project.toString("utf8").replace("status: active", "status: &state active\ncustom_property: *state"),
    );
    const note = parseMarkdown(raw);
    expect(note.kind).toBe("managed");
    expect(note.frontmatter?.physical.custom_property).toBe("active");
    expect(() => planScalarPropertyChange(note, "status", "paused")).toThrowError(
      expect.objectContaining({ code: "VAULT-108" }),
    );
  });

  it("invalidates every note sharing a managed Entity ID", () =>
    withSyntheticVault((root) => {
      writeFileSync(path.join(root, "first.md"), project);
      writeFileSync(path.join(root, "second.md"), project);
      const result = scanVault(root);
      expect(result.notes.map(({ note }) => note.kind)).toEqual(["invalid", "invalid"]);
      expect(result.notes.every(({ note }) => note.diagnostics.some(({ code }) => code === "SCHEMA-104"))).toBe(true);
      expect(result.diagnostics.filter(({ code }) => code === "SCHEMA-104")).toHaveLength(2);
    }));

  it("keeps BOM, CRLF, comments, unknown keys and body bytes during a scalar plan", () => {
    const source = project
      .toString("utf8")
      .replace("status: active", "status: active # user comment\ncustom_property: keep-me")
      .replaceAll("\n", "\r\n");
    const raw = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(source)]);
    const note = parseMarkdown(raw);
    expect(note.kind).toBe("managed");
    expect(note.bom).toBe(true);
    expect(note.newline).toBe("CRLF");
    const plan = planScalarPropertyChange(note, "status", "paused");
    const changed = parseMarkdown(plan.candidate);
    expect(changed.kind).toBe("managed");
    expect(changed.text).toContain("status: paused # user comment\r\ncustom_property: keep-me");
    expect(changed.bodyBytes.equals(note.bodyBytes)).toBe(true);
    expect(plan.preconditionHash).toBe(hashRaw(raw));
    expect(plan.candidateHash).toBe(hashRaw(plan.candidate));
    expect(() => planScalarPropertyChange(note, "id", "other")).toThrow(VaultError);
    expect(() => planScalarPropertyChange(note, "status", "impossible")).toThrow(VaultError);
  });

  it("treats unmanaged notes and malformed YAML as non-mutable", () => {
    expect(parseMarkdown(Buffer.from("# Ordinary note\n[[Related]]")).kind).toBe("unmanaged");
    const duplicateKey = Buffer.from(
      project.toString("utf8").replace("status: active", "status: active\nstatus: planned"),
    );
    const invalid = parseMarkdown(duplicateKey);
    expect(invalid.kind).toBe("invalid");
    expect(invalid.diagnostics[0]?.code).toBe("VAULT-104");
    expect(() => planScalarPropertyChange(invalid, "status", "paused")).toThrow(VaultError);
    const wrongPrefix = parseMarkdown(Buffer.from(project.toString("utf8").replace("id: prj_", "id: kn_")));
    expect(wrongPrefix.diagnostics.map((entry) => entry.code)).toContain("SCHEMA-103");
    expect(
      parseMarkdown(Buffer.from(project.toString("utf8").replace("type: project", "type: unknown"))).diagnostics[0]
        ?.code,
    ).toBe("SCHEMA-101");
    expect(parseMarkdown(Buffer.from("---\nstatus: active\n")).diagnostics[0]?.code).toBe("VAULT-102");
    expect(parseMarkdown(Buffer.from([0xff])).diagnostics[0]?.code).toBe("VAULT-101");
  });

  it("reports inherited object property names as invalid Entity types", () => {
    for (const type of ["toString", "constructor", "__proto__"]) {
      const note = parseMarkdown(Buffer.from(project.toString("utf8").replace("type: project", `type: ${type}`)));
      expect(note.kind).toBe("invalid");
      expect(note.diagnostics[0]?.code).toBe("SCHEMA-101");
    }
  });

  it("normalizes mapped properties without consuming a user-owned key", () => {
    const mapped = project.toString("utf8").replace("status: active", "status: user-state\nideomy_status: active");
    const note = parseMarkdown(Buffer.from(mapped), { status: "ideomy_status" });
    expect(note.kind).toBe("managed");
    expect(note.frontmatter?.physical.status).toBe("user-state");
    expect(note.logicalProperties?.status).toBe("active");
    expect(planScalarPropertyChange(note, "status", "paused").candidate.toString()).toContain(
      "status: user-state\nideomy_status: paused",
    );
    expect(normalizeProperties({}, { status: "same", type: "same" }).diagnostics[0]?.code).toBe("VAULT-107");
  });

  it("normalizes a valid physical-property swap independent of mapping order", () => {
    const physical = { status: "concept", subtype: "seed" };
    const expected = { logical: { status: "seed", subtype: "concept" }, diagnostics: [] };
    expect(normalizeProperties(physical, { status: "subtype", subtype: "status" })).toEqual(expected);
    expect(normalizeProperties(physical, { subtype: "status", status: "subtype" })).toEqual(expected);
  });

  it("rejects a mapping that collides with an unmapped logical property", () => {
    const raw = Buffer.from(
      project
        .toString("utf8")
        .replace(
          "topics: [obsidian, knowledge-management]",
          "topics: [obsidian, knowledge-management]\ntags: [personal]",
        ),
    );
    const note = parseMarkdown(raw, { tags: "topics" });
    expect(note.kind).toBe("invalid");
    expect(note.diagnostics.map(({ code }) => code)).toContain("VAULT-107");
  });

  it("extracts links, headings and AUTO boundaries outside code fences", () => {
    const structure = extractMarkdownStructure(
      "# Title\n[[Project|Alias]] ![[image.png]] [site](https://example.com)\n```md\n[[Ignored]]\n```\n<!-- BEGIN AUTO:summary -->\nText\n<!-- END AUTO:summary -->",
    );
    expect(structure.headings).toEqual([{ level: 1, text: "Title" }]);
    expect(structure.links.map((link) => [link.kind, link.target, link.embed])).toEqual([
      ["wiki", "Project", false],
      ["wiki", "image.png", true],
      ["markdown", "https://example.com", false],
    ]);
    expect(structure.fences).toHaveLength(2);
    expect(structure.autoSections).toEqual([{ name: "summary", begin: 6, end: 8 }]);
    expect(extractMarkdownStructure("<!-- BEGIN AUTO:x -->\n<!-- BEGIN AUTO:x -->").autoIssues).not.toHaveLength(0);
    expect(
      extractMarkdownStructure(
        "`[[ignored]]` [**nested**](https://example.com/a_(b)) [reference][ref]\n\n[ref]: /target",
      ).links,
    ).toEqual([
      { kind: "markdown", target: "https://example.com/a_(b)", alias: "nested", embed: false },
      { kind: "markdown", target: "/target", alias: "reference", embed: false },
    ]);
  });

  it("reports AUTO sections that close out of order", () => {
    const structure = extractMarkdownStructure(
      "<!-- BEGIN AUTO:a -->\n<!-- BEGIN AUTO:b -->\n<!-- END AUTO:a -->\n<!-- END AUTO:b -->",
    );
    expect(structure.autoIssues).toContain("mismatched AUTO end: a");
    expect(structure.autoSections).not.toContainEqual({ name: "a", begin: 1, end: 3 });
  });

  it("recognizes AUTO markers only as standalone top-level HTML comment lines", () => {
    for (const body of [
      "text <!-- BEGIN AUTO:x -->\nuser text\n<!-- END AUTO:x -->",
      "> <!-- BEGIN AUTO:x -->\n> user quote\n> <!-- END AUTO:x -->",
      "- item\n  <!-- BEGIN AUTO:x -->\n  user list\n  <!-- END AUTO:x -->",
    ]) {
      expect(extractMarkdownStructure(body).autoSections).toEqual([]);
    }
    for (const body of [
      "<pre>\n<!-- BEGIN AUTO:x -->\nUser content\n<!-- END AUTO:x -->\n</pre>",
      "<!-- user context\n<!-- BEGIN AUTO:x -->\n<!-- more context\n<!-- END AUTO:x -->",
    ]) {
      const structure = extractMarkdownStructure(body);
      expect(structure.autoSections).toEqual([]);
      expect(structure.autoIssues).toEqual([]);
    }
    expect(extractMarkdownStructure("<!-- BEGIN AUTO:x -->\nGenerated\n<!-- END AUTO:x -->").autoSections).toEqual([
      { name: "x", begin: 1, end: 3 },
    ]);
  });

  it("ignores escaped and entity-decoded wikilinks", () => {
    const structure = extractMarkdownStructure("\\[[escaped]] &#91;[encoded]] [[real]]");
    expect(structure.links).toEqual([{ kind: "wiki", target: "real", embed: false }]);
  });

  it("generates opaque IDs and keeps Vault identity outside notes", () =>
    withSyntheticVault((root) => {
      const first = generateEntityId("project");
      const second = generateEntityId("project");
      expect(first).toMatch(/^prj_[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(first).not.toBe(second);
      const identity = createVaultIdentity(root);
      expect(identity.vault_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(identity.fingerprint).toBe(deriveVaultFingerprint(root, identity.vault_id));
    }));

  it("preserves Entity ID across rename and detects duplicate IDs even with another schema error", () =>
    withSyntheticVault((root) => {
      const first = path.join(root, "first.md");
      writeFileSync(first, project);
      const id = scanVault(root).notes[0]?.note.logicalProperties?.id;
      renameSync(first, path.join(root, "renamed.md"));
      expect(scanVault(root).notes[0]?.note.logicalProperties?.id).toBe(id);
      writeFileSync(
        path.join(root, "invalid.md"),
        project.toString("utf8").replace("status: active", "status: impossible"),
      );
      expect(scanVault(root).diagnostics.map((entry) => entry.code)).toContain("SCHEMA-104");
    }));

  it("rejects traversal and symlink escape without reading outside the Vault", () =>
    withSyntheticVault((root) => {
      const outside = mkdtempSync(path.join(tmpdir(), "ideomy-outside-"));
      try {
        writeFileSync(path.join(root, "safe.md"), "# Safe\n");
        writeFileSync(path.join(outside, "secret.md"), "synthetic-secret");
        symlinkSync(path.join(outside, "secret.md"), path.join(root, "escape.md"));
        expect(resolveVaultFile(root, "safe.md")).toBe(path.join(realpathSync(root), "safe.md"));
        expect(() => resolveVaultFile(root, "../outside.md")).toThrow(VaultError);
        expect(() => resolveVaultFile(root, "escape.md")).toThrow(VaultError);
        expect(scanVault(root).diagnostics.map((entry) => entry.code)).toContain("VAULT-105");
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    }));

  it("continues past an unreadable note without reporting it as deleted", () =>
    withSyntheticVault((root) => {
      const unreadable = path.join(root, "unreadable.md");
      writeFileSync(path.join(root, "safe.md"), "# Safe\n");
      writeFileSync(unreadable, "# Private\n");
      const events: { kind: string; path: string; code?: string }[] = [];
      const watcher = new VaultWatcher(root, (event) => events.push(event));
      try {
        chmodSync(unreadable, 0o000);
        const scan = scanVault(root);
        expect(scan.notes.map((entry) => entry.path)).toEqual(["safe.md"]);
        expect(scan.diagnostics).toEqual([
          { code: "VAULT-110", severity: "error", message: "Markdown file could not be read.", path: "unreadable.md" },
        ]);
        new VaultWatcher(root, () => {}).close();
        watcher.reconcileAll();
        expect(events).toEqual([{ kind: "error", path: "unreadable.md", code: "VAULT-110" }]);
        chmodSync(unreadable, 0o600);
        writeFileSync(unreadable, "# Updated\n");
        watcher.reconcileAll();
        expect(events.at(-1)).toMatchObject({ kind: "change", path: "unreadable.md" });
      } finally {
        chmodSync(unreadable, 0o600);
        watcher.close();
      }
    }));

  it("keeps notes under an unreadable directory until access recovers", () =>
    withSyntheticVault((root) => {
      const blocked = path.join(root, "blocked");
      mkdirSync(blocked);
      const note = path.join(blocked, "note.md");
      writeFileSync(note, "# Before\n");
      const events: { kind: string; path: string; code?: string }[] = [];
      const watcher = new VaultWatcher(root, (event) => events.push(event));
      try {
        chmodSync(blocked, 0o000);
        expect(scanVault(root).diagnostics).toEqual([
          { code: "VAULT-110", severity: "error", message: "Vault directory could not be read.", path: "blocked" },
        ]);
        watcher.reconcileAll();
        expect(events).toEqual([{ kind: "error", path: "blocked", code: "VAULT-110" }]);
        chmodSync(blocked, 0o700);
        writeFileSync(note, "# After\n");
        watcher.reconcileAll();
        expect(events.at(-1)).toMatchObject({ kind: "change", path: path.join("blocked", "note.md") });
      } finally {
        chmodSync(blocked, 0o700);
        watcher.close();
      }
    }));

  it("suppresses a committed write but emits external changes and deletion", () =>
    withSyntheticVault((root) => {
      const file = path.join(root, "note.md");
      writeFileSync(file, "# Before\n");
      const events: string[] = [];
      const watcher = new VaultWatcher(root, (event) => events.push(event.kind));
      const committed = Buffer.from("# Core write\n");
      watcher.ownWrites.record("note.md", hashRaw(committed));
      writeFileSync(file, committed);
      watcher.reconcile("note.md");
      expect(events).toEqual([]);
      writeFileSync(file, "# External edit\n");
      watcher.reconcile("note.md");
      expect(events).toEqual(["change"]);
      rmSync(file);
      watcher.reconcile("note.md");
      expect(events).toEqual(["change", "unlink"]);
      watcher.close();
    }));
});
