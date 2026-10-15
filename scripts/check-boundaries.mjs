import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPackages = {
  core: new Set([
    "vault-io",
    "schema",
    "index",
    "graph",
    "retrieval",
    "transactions",
    "model-gateway",
    "platform",
    "contracts",
  ]),
  cli: new Set(["bootstrap", "core-client", "platform", "contracts"]),
  "obsidian-plugin": new Set(["core-client", "contracts", "config"]),
};
const forbiddenProviderSdk = /^(?:openai|@anthropic-ai\/sdk|@google\/genai)$/;
const nodeBuiltins = /^(?:node:|fs(?:\/|$)|path(?:\/|$)|child_process$|crypto$|os$|net$|http$)/;

export function checkImport(owner, specifier, file) {
  const [kind, name] = owner;
  if (specifier.startsWith(".")) {
    const target = path.resolve(path.dirname(file), specifier);
    const packageRoot = path.join(root, kind, name);
    if (target !== packageRoot && !target.startsWith(`${packageRoot}${path.sep}`)) {
      return "relative import escapes package boundary";
    }
    return null;
  }
  if (kind === "apps" && name === "obsidian-plugin" && nodeBuiltins.test(specifier)) {
    return "Plugin imports Node API";
  }
  if (kind === "packages" && name === "contracts" && nodeBuiltins.test(specifier)) {
    return "contracts import Node API";
  }
  if ((kind === "packages" || name === "core") && specifier === "obsidian") {
    return "Core domain imports Obsidian API";
  }
  if (name !== "model-gateway" && forbiddenProviderSdk.test(specifier)) {
    return "provider SDK outside Model Gateway";
  }
  if (specifier.startsWith("@ideomy/")) {
    const dependency = specifier.slice("@ideomy/".length).split("/")[0];
    if (kind === "packages" && name === "contracts") return "contracts import another Ideomy package";
    if (kind === "apps" && !appPackages[name]?.has(dependency)) {
      return `${name} imports forbidden package ${dependency}`;
    }
  }
  return null;
}

function* sourceFiles(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(target);
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name))
      yield target;
  }
}

const importPattern = /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s*)(["'])([^"']+)\1/g;

export function checkRepository() {
  const errors = [];
  for (const kind of ["apps", "packages"]) {
    for (const file of sourceFiles(path.join(root, kind))) {
      const relative = path.relative(root, file);
      const owner = relative.split(path.sep).slice(0, 2);
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(importPattern)) {
        const reason = checkImport(owner, match[2], file);
        if (reason) errors.push(`${relative}: ${reason} (${match[2]})`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkRepository();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Architecture import boundaries valid");
}
