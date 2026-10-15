import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function loadSchemas(directory) {
  const names = fs.readdirSync(path.join(root, directory)).filter((name) => name.endsWith(".schema.json"));
  for (const name of names) {
    const schema = readJson(path.join(directory, name));
    if (!ajv.validateSchema(schema)) {
      throw new Error(`${directory}/${name}: ${ajv.errorsText(ajv.errors)}`);
    }
    ajv.addSchema(schema);
  }
  return names;
}

function validateSchemas() {
  loadSchemas("schemas");
  const names = loadSchemas("schemas/entities");
  const registry = readJson("schemas/registry.json");
  const registered = Object.entries(registry.types);
  if (registered.length !== names.length) throw new Error("Entity registry/schema count mismatch");
  for (const [type, config] of registered) {
    const schema = readJson(`schemas/${config.schema}`);
    if (schema.allOf?.[1]?.properties?.type?.const !== type) {
      throw new Error(`Entity type mismatch: ${type}`);
    }
    ajv.getSchema(schema.$id);
  }
  console.log(`Validated ${names.length} entity schemas and registry`);
}

function validateContracts() {
  const names = loadSchemas("contracts/protocol/v1");
  for (const name of names) {
    const example = readJson(`contracts/examples/${name.replace(".schema", "")}`);
    const schema = readJson(`contracts/protocol/v1/${name}`);
    const valid = ajv.getSchema(schema.$id);
    if (!valid(example)) throw new Error(`${name}: ${ajv.errorsText(valid.errors)}`);
  }
  const capture = readJson("contracts/capture/web-capture-v1.schema.json");
  if (!ajv.validateSchema(capture)) throw new Error("Invalid Web Capture schema");
  ajv.addSchema(capture);
  const validCapture = ajv.getSchema(capture.$id);
  if (!validCapture(readJson("contracts/capture/web-capture-v1.example.json"))) {
    throw new Error(`Web Capture example: ${ajv.errorsText(validCapture.errors)}`);
  }
  console.log(`Validated ${names.length} protocol schemas/examples and Web Capture contract`);
}

function* markdownFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Fixture symlink is forbidden: ${target}`);
    if (entry.isDirectory()) yield* markdownFiles(target);
    else if (entry.name.endsWith(".md")) yield target;
  }
}

function validateFixtures() {
  validateSchemas();
  const registry = readJson("schemas/registry.json");
  const expectedInvalid = new Set(readJson("fixtures/test-vault/FIXTURE_MANIFEST.json").expected_invalid);
  const seenIds = new Map();
  const actualInvalid = new Set();
  const fixtureRoot = path.join(root, "fixtures/test-vault");
  let count = 0;
  for (const file of markdownFiles(fixtureRoot)) {
    count++;
    const relative = path.relative(fixtureRoot, file);
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.startsWith("---\n")) continue;
    const end = raw.indexOf("\n---", 4);
    if (end < 0) throw new Error(`${relative}: unclosed frontmatter`);
    const document = YAML.parseDocument(raw.slice(4, end), { uniqueKeys: true });
    const issues = document.errors.map((error) => error.message);
    const data = document.toJS();
    if (data?.ideomy_schema !== undefined) {
      const config = registry.types[data.type];
      if (!config) issues.push(`unknown managed type: ${data.type}`);
      else {
        const schema = readJson(`schemas/${config.schema}`);
        const valid = ajv.getSchema(schema.$id);
        if (!valid(data)) issues.push(ajv.errorsText(valid.errors));
        if (typeof data.id === "string") {
          if (!data.id.startsWith(`${config.prefix}_`)) issues.push("ID prefix/type mismatch");
          if (seenIds.has(data.id)) issues.push(`duplicate managed ID: ${seenIds.get(data.id)}`);
          else seenIds.set(data.id, relative);
        }
      }
    }
    if (issues.length) actualInvalid.add(relative);
    if (issues.length && !expectedInvalid.has(relative)) {
      throw new Error(`${relative}: ${issues.join("; ")}`);
    }
  }
  if (expectedInvalid.size !== actualInvalid.size || [...expectedInvalid].some((name) => !actualInvalid.has(name))) {
    throw new Error("Expected-invalid fixture set does not match detected invalid fixtures");
  }
  console.log(`Validated ${count} synthetic fixture notes (${actualInvalid.size} expected invalid)`);
}

const mode = process.argv[2];
if (mode === "schemas") validateSchemas();
else if (mode === "contracts") validateContracts();
else if (mode === "fixtures") validateFixtures();
else throw new Error("Usage: validate-artifacts.mjs schemas|contracts|fixtures");
