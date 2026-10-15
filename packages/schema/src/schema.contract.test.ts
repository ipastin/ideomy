import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { z } from "zod";
import { entitySchemas, type ManagedEntityType } from "./index.js";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const registry = read("schemas/registry.json");
const seedAjv = new Ajv2020.default({ strict: false });
const generatedAjv = new Ajv2020.default({ strict: false });
addFormats.default(seedAjv);
addFormats.default(generatedAjv);
seedAjv.addSchema(read("schemas/base.schema.json"));

const validators = Object.fromEntries(
  Object.entries(entitySchemas).map(([type, schema]) => {
    const seed = read(`schemas/entities/${type}.schema.json`);
    const generated = z.toJSONSchema(schema);
    return [type, [seedAjv.compile(seed), generatedAjv.compile(generated), schema] as const];
  }),
) as Record<
  ManagedEntityType,
  readonly [
    ReturnType<typeof seedAjv.compile>,
    ReturnType<typeof generatedAjv.compile>,
    (typeof entitySchemas)[ManagedEntityType],
  ]
>;

function* fixtureFiles(directory: string): Generator<string> {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* fixtureFiles(name);
    else if (entry.name.endsWith(".md")) yield name;
  }
}

describe("managed entity contract adoption", () => {
  const examples = new Map<ManagedEntityType, Record<string, unknown>>();
  for (const name of fixtureFiles(path.join(root, "fixtures/test-vault"))) {
    const raw = fs.readFileSync(name, "utf8");
    if (!raw.startsWith("---\n")) continue;
    const end = raw.indexOf("\n---", 4);
    const data = YAML.parseDocument(raw.slice(4, end)).toJS();
    if (data?.ideomy_schema && !examples.has(data.type)) examples.set(data.type, data);
  }

  it("covers every managed type with a synthetic fixture", () => {
    expect([...examples.keys()].sort()).toEqual(Object.keys(entitySchemas).sort());
    expect(Object.keys(registry.types).sort()).toEqual(Object.keys(entitySchemas).sort());
    for (const [type, schema] of Object.entries(entitySchemas)) {
      const generated = z.toJSONSchema(schema);
      expect((generated.properties?.status as { enum?: string[] }).enum).toEqual(registry.types[type].statuses);
      if (registry.types[type].subtypes.length) {
        expect((generated.properties?.subtype as { enum?: string[] }).enum).toEqual(registry.types[type].subtypes);
      }
    }
  });

  it.each([...examples.entries()])("%s: seed, generated and runtime schemas agree", (type, example) => {
    const [seed, generated, runtime] = validators[type];
    for (const data of [
      example,
      { ...example, status: "not-a-status" },
      { ...example, id: "bad-id" },
      { ...example, tags: ["duplicate", "duplicate"] },
    ]) {
      const expected = Boolean(seed(data));
      expect(Boolean(generated(data))).toBe(expected);
      expect(runtime.safeParse(data).success).toBe(expected);
    }
  });
});
