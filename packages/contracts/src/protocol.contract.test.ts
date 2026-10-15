import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { protocolSchemas } from "./index.js";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const ajv = new Ajv2020.default({ strict: false });
addFormats.default(ajv);

describe("Core protocol V1 contract adoption", () => {
  it.each(Object.entries(protocolSchemas))("%s: example and strict object boundary", (name, runtime) => {
    const seed = ajv.compile(read(`contracts/protocol/v1/${name}.schema.json`));
    const generated = ajv.compile(z.toJSONSchema(runtime));
    const example = read(`contracts/examples/${name}.json`);
    expect(seed(example)).toBe(true);
    expect(generated(example)).toBe(true);
    expect(runtime.safeParse(example).success).toBe(true);
    const extra = { ...example, unexpected: true };
    expect(seed(extra)).toBe(false);
    expect(generated(extra)).toBe(false);
    expect(runtime.safeParse(extra).success).toBe(false);
  });
});
