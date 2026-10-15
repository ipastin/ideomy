import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkImport, checkRepository } from "./check-boundaries.mjs";

const root = path.resolve(import.meta.dirname, "..");

describe("architecture import boundaries", () => {
  it("accepts the documented Plugin client edge", () => {
    expect(
      checkImport(
        ["apps", "obsidian-plugin"],
        "@ideomy/core-client",
        path.join(root, "apps/obsidian-plugin/src/main.ts"),
      ),
    ).toBeNull();
  });

  it("rejects Core internals and Node in Plugin", () => {
    const file = path.join(root, "apps/obsidian-plugin/src/main.ts");
    expect(checkImport(["apps", "obsidian-plugin"], "@ideomy/vault-io", file)).toMatch(/forbidden/);
    expect(checkImport(["apps", "obsidian-plugin"], "node:fs", file)).toMatch(/Node API/);
    expect(checkImport(["apps", "obsidian-plugin"], "../../core/src/main.js", file)).toMatch(/escapes/);
  });

  it("rejects provider SDK outside Model Gateway", () => {
    expect(checkImport(["packages", "schema"], "openai", path.join(root, "packages/schema/src/index.ts"))).toMatch(
      /provider SDK/,
    );
  });

  it("checks the current workspace", () => {
    expect(checkRepository()).toEqual([]);
  });
});
