import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { deriveVaultFingerprint, normalizeProperties, scanVault } from "@ideomy/vault-io";

type VaultProfile = {
  stateDirectory: string;
  vaultId: string;
  vaultFingerprint: string;
  vaultPath?: string;
  propertyMapping?: Record<string, string>;
};

export function inspectVault(profile: VaultProfile) {
  if (!profile.vaultPath) {
    return { vault: "bound", schema: "unavailable", index: "unavailable", diagnostics: [], manifest: null };
  }
  try {
    const root = realpathSync(profile.vaultPath);
    if (deriveVaultFingerprint(root, profile.vaultId) !== profile.vaultFingerprint) {
      return { vault: "mismatch", schema: "invalid", index: "invalid", diagnostics: ["VAULT-004"], manifest: null };
    }
    const mapping = profile.propertyMapping ?? {};
    const scanned = scanVault(root, mapping);
    const diagnostics = [...normalizeProperties({}, mapping).diagnostics, ...scanned.diagnostics];
    const errors = diagnostics.filter((item) => item.severity === "error");
    if (errors.length) {
      return {
        vault: "bound",
        schema: "invalid",
        index: "invalid",
        diagnostics: [...new Set(errors.map((item) => item.code))],
        manifest: null,
      };
    }
    const postings = new Map<string, string[]>();
    for (const { path: notePath, note } of scanned.notes) {
      const tokens = new Set(
        note.bodyBytes
          .toString("utf8")
          .normalize("NFKC")
          .toLowerCase()
          .match(/[\p{L}\p{N}]+/gu) ?? [],
      );
      for (const token of tokens) {
        const paths = postings.get(token) ?? [];
        paths.push(notePath);
        postings.set(token, paths);
      }
    }
    // shortcut: Bootstrap indexes token presence without ranking/positions; M1 adds SQLite/FTS.
    const manifest = JSON.stringify({
      version: 2,
      vault_id: profile.vaultId,
      vault_fingerprint: profile.vaultFingerprint,
      property_mapping: Object.fromEntries(Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b))),
      postings: Object.fromEntries([...postings].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
      notes: scanned.notes.map(({ path: notePath, note }) => ({
        path: notePath,
        hash: note.hash,
        kind: note.kind,
        ...(note.kind === "managed"
          ? {
              id: note.logicalProperties?.id,
              type: note.logicalProperties?.type,
              status: note.logicalProperties?.status,
            }
          : {}),
      })),
    });
    let index = "missing";
    try {
      const cached = readFileSync(path.join(profile.stateDirectory, "bootstrap-index.json"), "utf8");
      index = cached === manifest ? "current" : "stale";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") index = "invalid";
    }
    return {
      vault: "bound",
      schema: "valid",
      index,
      diagnostics: [...new Set(diagnostics.map((item) => item.code))],
      manifest,
    };
  } catch {
    return {
      vault: "unavailable",
      schema: "unavailable",
      index: "unavailable",
      diagnostics: ["VAULT-110"],
      manifest: null,
    };
  }
}
