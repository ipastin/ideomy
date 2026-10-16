import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, it } from "vitest";
import manifest from "../manifest.json" with { type: "json" };

it("bundles for browsers with only the host Obsidian API external", async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("./main.ts", import.meta.url))],
    bundle: true,
    platform: "browser",
    format: "cjs",
    target: "es2022",
    external: ["obsidian"],
    write: false,
    metafile: true,
  });
  const imports = Object.values(result.metafile.outputs).flatMap((output) => output.imports.map((entry) => entry.path));
  expect(imports).toEqual(["obsidian"]);
  expect(manifest.id).toBe("ideomy");
  expect(manifest.isDesktopOnly).toBe(false);
});
