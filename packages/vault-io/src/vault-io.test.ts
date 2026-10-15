import { mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
      ["SCHEMA-104", "90 Archive/INVALID — Duplicate ID.md"],
    ]);
    expect(result.notes.find((entry) => entry.path.endsWith("Unmanaged Existing Note.md"))?.note.kind).toBe(
      "unmanaged",
    );
    expect(result.notes.filter((entry) => entry.note.kind === "invalid")).toHaveLength(0);
  });

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
