import { createHash, randomBytes, randomUUID } from "node:crypto";
import { type Dirent, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { entitySchemas, type ManagedEntityType, typePrefixes } from "@ideomy/schema";
import YAML, { isMap, isScalar } from "yaml";
import { extractMarkdownStructure, type MarkdownStructure } from "./links.ts";

export { extractMarkdownStructure, type MarkdownStructure } from "./links.ts";

export type VaultDiagnostic = {
  code: string;
  severity: "error" | "warning";
  message: string;
  path?: string;
};

export type ParsedNote = {
  kind: "managed" | "unmanaged" | "invalid";
  raw: Buffer;
  text: string;
  hash: string;
  bom: boolean;
  newline: "LF" | "CRLF" | "mixed" | "none";
  bodyBytes: Buffer;
  frontmatter: null | {
    yamlStart: number;
    yamlEnd: number;
    bodyStart: number;
    document: ReturnType<typeof YAML.parseDocument>;
    physical: Record<string, unknown>;
  };
  logicalProperties: Record<string, unknown> | null;
  mapping: Record<string, string>;
  structure: MarkdownStructure;
  diagnostics: VaultDiagnostic[];
};

const issue = (code: string, message: string, path?: string): VaultDiagnostic => ({
  code,
  severity: "error",
  message,
  ...(path ? { path } : {}),
});

export const hashRaw = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const logicalPropertyNames = new Set(Object.values(entitySchemas).flatMap((schema) => Object.keys(schema.shape)));

export function normalizeProperties(
  physical: Record<string, unknown>,
  mapping: Record<string, string>,
): { logical: Record<string, unknown>; diagnostics: VaultDiagnostic[] } {
  const logical = { ...physical };
  const diagnostics: VaultDiagnostic[] = [];
  const physicalKeys = new Set<string>();
  const mapped: [string, string][] = [];
  for (const [name, target] of Object.entries(mapping)) {
    if (
      !logicalPropertyNames.has(name) ||
      !target ||
      physicalKeys.has(target) ||
      [...logicalPropertyNames].some((other) => other !== name && (mapping[other] ?? other) === target)
    ) {
      diagnostics.push(issue("VAULT-107", `Invalid or duplicate physical property mapping: ${name} → ${target}`));
      continue;
    }
    physicalKeys.add(target);
    if (name === target) continue;
    mapped.push([name, target]);
  }
  for (const [name, target] of mapped) {
    delete logical[name];
    delete logical[target];
  }
  for (const [name, target] of mapped) {
    if (Object.hasOwn(physical, target)) logical[name] = physical[target];
  }
  return { logical, diagnostics };
}

function newlineStyle(text: string): ParsedNote["newline"] {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  if (crlf && lf) return "mixed";
  if (crlf) return "CRLF";
  if (lf) return "LF";
  return "none";
}

export function parseMarkdown(bytes: Uint8Array, mapping: Record<string, string> = {}): ParsedNote {
  const raw = Buffer.from(bytes);
  const bom = raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const diagnostics: VaultDiagnostic[] = [];
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw.subarray(bom ? 3 : 0));
  } catch {
    text = "";
    diagnostics.push(issue("VAULT-101", "Markdown is not valid UTF-8."));
  }
  const structure = extractMarkdownStructure(text);
  const base: ParsedNote = {
    kind: diagnostics.length ? "invalid" : "unmanaged",
    raw,
    text,
    hash: hashRaw(raw),
    bom,
    newline: newlineStyle(text),
    bodyBytes: raw.subarray(bom ? 3 : 0),
    frontmatter: null,
    logicalProperties: null,
    mapping: { ...mapping },
    structure,
    diagnostics,
  };
  if (diagnostics.length) return base;

  const opening = text.match(/^---(?:\r\n|\n)/);
  if (!opening) return base;
  const yamlStart = opening[0].length;
  const closing = /^---[ \t]*(?:\r\n|\n|$)/gm.exec(text.slice(yamlStart));
  if (!closing) {
    diagnostics.push(issue("VAULT-102", "Frontmatter opening delimiter has no closing delimiter."));
    return { ...base, kind: "invalid" };
  }
  const yamlEnd = yamlStart + closing.index;
  const bodyStart = yamlEnd + closing[0].length;
  const yamlText = text.slice(yamlStart, yamlEnd);
  const document = YAML.parseDocument(yamlText, { uniqueKeys: true, keepSourceTokens: true });
  for (const error of document.errors) {
    diagnostics.push(issue(error.code === "DUPLICATE_KEY" ? "VAULT-104" : "VAULT-103", error.message));
  }
  if (!isMap(document.contents)) diagnostics.push(issue("VAULT-103", "Frontmatter must be a YAML mapping."));
  let physical: Record<string, unknown> = {};
  if (!diagnostics.length) {
    try {
      physical = document.toJS({ maxAliasCount: 100 }) as Record<string, unknown>;
    } catch {
      diagnostics.push(issue("VAULT-103", "Frontmatter aliases or values could not be resolved safely."));
    }
  }
  const normalized = normalizeProperties(physical, mapping);
  diagnostics.push(...normalized.diagnostics);
  const bodyOffset = (bom ? 3 : 0) + Buffer.byteLength(text.slice(0, bodyStart));
  const frontmatter = { yamlStart, yamlEnd, bodyStart, document, physical };
  const parsed: ParsedNote = {
    ...base,
    bodyBytes: raw.subarray(bodyOffset),
    frontmatter,
    logicalProperties: normalized.logical,
    structure: extractMarkdownStructure(text.slice(bodyStart)),
  };
  if (diagnostics.length) return { ...parsed, kind: "invalid" };
  if (!Object.hasOwn(physical, mapping.ideomy_schema ?? "ideomy_schema")) return parsed;

  const properties = normalized.logical;
  const type = properties.type;
  if (properties.ideomy_schema !== 1 || typeof type !== "string" || !Object.hasOwn(entitySchemas, type)) {
    diagnostics.push(issue("SCHEMA-101", "Managed marker or entity type is invalid."));
    return { ...parsed, kind: "invalid" };
  }
  const entityType = type as ManagedEntityType;
  const result = entitySchemas[entityType].safeParse(properties);
  if (!result.success) {
    for (const error of result.error.issues) {
      diagnostics.push(issue("SCHEMA-102", `${error.path.join(".") || "frontmatter"}: ${error.message}`));
    }
  }
  if (typeof properties.id === "string" && !properties.id.startsWith(`${typePrefixes[entityType]}_`)) {
    diagnostics.push(issue("SCHEMA-103", "Entity ID prefix does not match its type."));
  }
  return { ...parsed, kind: diagnostics.length ? "invalid" : "managed" };
}

export class VaultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "VaultError";
    this.code = code;
  }
}

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function resolveVaultFile(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.includes("\0"))
    throw new VaultError("VAULT-105", "Expected a relative Vault path.");
  const resolvedRoot = realpathSync(root);
  const candidate = path.resolve(resolvedRoot, relativePath);
  if (!inside(resolvedRoot, candidate)) throw new VaultError("VAULT-105", "Path escapes the configured Vault.");
  const realTarget = realpathSync(candidate);
  if (!inside(resolvedRoot, realTarget)) throw new VaultError("VAULT-105", "Symlink escapes the configured Vault.");
  return realTarget;
}

export function readVaultNote(root: string, relativePath: string, mapping: Record<string, string> = {}): ParsedNote {
  return parseMarkdown(readFileSync(resolveVaultFile(root, relativePath)), mapping);
}

export function scanVault(
  root: string,
  mapping: Record<string, string> = {},
): {
  notes: { path: string; note: ParsedNote }[];
  diagnostics: VaultDiagnostic[];
} {
  const resolvedRoot = realpathSync(root);
  const notes: { path: string; note: ParsedNote }[] = [];
  const diagnostics: VaultDiagnostic[] = [];
  const entriesById = new Map<string, { path: string; note: ParsedNote }[]>();
  const visit = (directory: string) => {
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (directory === resolvedRoot) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        diagnostics.push(
          issue("VAULT-110", "Vault directory could not be read.", path.relative(resolvedRoot, directory)),
        );
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(resolvedRoot, absolute);
      if (entry.isSymbolicLink()) {
        try {
          const target = realpathSync(absolute);
          if (target !== resolvedRoot && !inside(resolvedRoot, target)) {
            diagnostics.push(issue("VAULT-105", "Symlink escapes the configured Vault.", relative));
          } else {
            diagnostics.push({
              code: "VAULT-109",
              severity: "warning",
              message: "Internal symlink is not traversed during Vault scan.",
              path: relative,
            });
          }
        } catch {
          diagnostics.push(issue("VAULT-105", "Symlink target cannot be resolved safely.", relative));
        }
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      let note: ParsedNote;
      try {
        note = readVaultNote(resolvedRoot, relative, mapping);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        diagnostics.push(
          issue(
            error instanceof VaultError ? error.code : "VAULT-110",
            error instanceof VaultError ? error.message : "Markdown file could not be read.",
            relative,
          ),
        );
        continue;
      }
      const noteEntry = { path: relative, note };
      notes.push(noteEntry);
      diagnostics.push(...note.diagnostics.map((diagnostic) => ({ ...diagnostic, path: relative })));
      const id = note.logicalProperties?.id;
      if (note.logicalProperties?.ideomy_schema === 1 && typeof id === "string") {
        const matching = entriesById.get(id) ?? [];
        matching.push(noteEntry);
        entriesById.set(id, matching);
      }
    }
  };
  visit(resolvedRoot);
  for (const matching of entriesById.values()) {
    if (matching.length < 2) continue;
    for (const entry of matching) {
      const other = matching.find((candidate) => candidate !== entry);
      const diagnostic = issue("SCHEMA-104", `Duplicate managed ID also appears in ${other?.path}.`, entry.path);
      entry.note.kind = "invalid";
      entry.note.diagnostics.push(diagnostic);
      diagnostics.push(diagnostic);
    }
  }
  return { notes, diagnostics };
}

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const encode = (value: bigint, length: number): string => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result = alphabet[Number(value & 31n)] + result;
    value >>= 5n;
  }
  return result;
};

export function generateEntityId(type: ManagedEntityType): string {
  const random = BigInt(`0x${randomBytes(10).toString("hex")}`);
  return `${typePrefixes[type]}_${encode(BigInt(Date.now()), 10)}${encode(random, 16)}`;
}

export function createVaultIdentity(root: string): { vault_id: string; fingerprint: string } {
  const vault_id = randomUUID();
  return { vault_id, fingerprint: deriveVaultFingerprint(root, vault_id) };
}

export function deriveVaultFingerprint(root: string, vaultId: string): string {
  return createHash("sha256")
    .update(`${vaultId}\0${realpathSync(root)}`)
    .digest("hex");
}

export function planScalarPropertyChange(
  note: ParsedNote,
  logicalKey: string,
  value: string | number | boolean | null,
): {
  preconditionHash: string;
  candidate: Buffer;
  candidateHash: string;
} {
  if (
    note.kind !== "managed" ||
    !note.frontmatter ||
    note.newline === "mixed" ||
    ["id", "type", "ideomy_schema"].includes(logicalKey)
  ) {
    throw new VaultError("VAULT-108", "Only an existing mutable scalar on a valid managed note can be planned.");
  }
  if (typeof value === "string" && /[\r\n]/.test(value))
    throw new VaultError("VAULT-108", "Multiline scalar requires a dedicated typed mutation.");
  const type = note.logicalProperties?.type as ManagedEntityType;
  if (!Object.hasOwn(entitySchemas[type].shape, logicalKey))
    throw new VaultError("VAULT-108", "Unknown or user-owned property requires an explicit reviewed mutation.");
  const physicalKey = note.mapping[logicalKey] ?? logicalKey;
  const pair = isMap(note.frontmatter.document.contents)
    ? note.frontmatter.document.contents.items.find((item) => isScalar(item.key) && item.key.value === physicalKey)
    : undefined;
  if (!pair || !isScalar(pair.value) || !pair.value.range || pair.value.anchor) {
    throw new VaultError("VAULT-108", "Target property is missing or is not a plain YAML scalar.");
  }
  const [start, end] = pair.value.range;
  const replacement = YAML.stringify(value, { lineWidth: 0 }).trimEnd();
  const startInText = note.frontmatter.yamlStart + start;
  const endInText = note.frontmatter.yamlStart + end;
  const changed = note.text.slice(0, startInText) + replacement + note.text.slice(endInText);
  const candidate = Buffer.concat([...(note.bom ? [Buffer.from([0xef, 0xbb, 0xbf])] : []), Buffer.from(changed)]);
  const checked = parseMarkdown(candidate, note.mapping);
  if (checked.kind !== "managed" || checked.logicalProperties?.id !== note.logicalProperties?.id) {
    throw new VaultError("SCHEMA-102", "Candidate metadata does not validate or changes Entity identity.");
  }
  return { preconditionHash: note.hash, candidate, candidateHash: hashRaw(candidate) };
}

export function planAutoBodyChange(
  note: ParsedNote,
  name: string,
  replacement: string,
): { preconditionHash: string; candidate: Buffer; candidateHash: string } {
  const section = note.structure.autoSections.find((entry) => entry.name === name);
  if (note.kind !== "managed" || note.newline === "mixed" || note.structure.autoIssues.length || !section)
    throw new VaultError("VAULT-108", "AUTO body change requires a valid managed note and a unique marker pair.");

  const lineStarts = [0];
  for (let i = 0; i < note.bodyBytes.length; i++) if (note.bodyBytes[i] === 10) lineStarts.push(i + 1);
  const start = lineStarts[section.begin];
  const end = lineStarts[section.end - 1];
  if (start === undefined || end === undefined || start > end)
    throw new VaultError("VAULT-108", "AUTO section boundaries are invalid.");

  const newline = note.newline === "CRLF" ? "\r\n" : "\n";
  const normalized = replacement.replace(/\r\n?|\n/g, "\n").replace(/\n/g, newline);
  const payload = normalized && !normalized.endsWith(newline) ? normalized + newline : normalized;
  const bodyOffset = note.raw.length - note.bodyBytes.length;
  const candidate = Buffer.concat([
    note.raw.subarray(0, bodyOffset + start),
    Buffer.from(payload),
    note.raw.subarray(bodyOffset + end),
  ]);
  const checked = parseMarkdown(candidate, note.mapping);
  if (
    checked.kind !== "managed" ||
    checked.logicalProperties?.id !== note.logicalProperties?.id ||
    checked.structure.autoIssues.length ||
    checked.structure.autoSections.map((entry) => entry.name).join("\0") !==
      note.structure.autoSections.map((entry) => entry.name).join("\0")
  ) {
    throw new VaultError("VAULT-108", "AUTO body candidate changes managed identity or marker structure.");
  }
  return { preconditionHash: note.hash, candidate, candidateHash: hashRaw(candidate) };
}
