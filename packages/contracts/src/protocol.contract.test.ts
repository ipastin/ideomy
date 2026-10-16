import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cliOutputSchema, protocolSchemas } from "./index.js";

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
    if (name === "operation") {
      const operation = example as { created_at: string; updated_at: string };
      for (const value of [
        operation.created_at.replace("T", "t").replace(/Z$/, "z"),
        "2016-12-31T23:59:60Z",
        "2026-10-12 12:00:00Z",
        "2026-10-12T12:00:00+0300",
        "2026-13-12T12:00:00Z",
      ]) {
        const variant = { ...operation, created_at: value, updated_at: value };
        expect(Boolean(generated(variant))).toBe(Boolean(seed(variant)));
        expect(runtime.safeParse(variant).success).toBe(Boolean(seed(variant)));
      }
      for (const value of ["2026-10-12 12:00:00Z", "2026-10-12T12:00:00+0300"]) {
        const invalid = { ...operation, created_at: value, updated_at: value };
        expect(Boolean(seed(invalid))).toBe(false);
        expect(Boolean(generated(invalid))).toBe(false);
        expect(runtime.safeParse(invalid).success).toBe(false);
      }
    }
    const extra = { ...example, unexpected: true };
    expect(seed(extra)).toBe(false);
    expect(generated(extra)).toBe(false);
    expect(runtime.safeParse(extra).success).toBe(false);
  });

  it.each([
    ["discovery", "started_at"],
    ["pair-window-response", "expires_at"],
    ["auth-challenge-response", "expires_at"],
    ["auth-session-response", "expires_at"],
  ] as const)("%s: timestamp follows RFC 3339 across seed, generated and runtime", (name, field) => {
    const schema = read(`contracts/protocol/v1/${name}.schema.json`);
    const seed = ajv.getSchema(schema.$id) ?? ajv.compile(schema);
    const runtime = protocolSchemas[name];
    const generated = ajv.compile(z.toJSONSchema(runtime));
    const example = read(`contracts/examples/${name}.json`);
    for (const [value, expected] of [
      ["2026-10-12t12:00:00z", true],
      ["2016-12-31T23:59:60Z", true],
      ["2026-10-12T12:00:00+0300", false],
    ] as const) {
      const variant = { ...example, [field]: value };
      expect(Boolean(seed(variant))).toBe(expected);
      expect(Boolean(generated(variant))).toBe(expected);
      expect(runtime.safeParse(variant).success).toBe(expected);
    }
  });
});

describe("CLI JSON V1 contract", () => {
  it("accepts the canonical envelope and rejects malformed diagnostics", () => {
    const validate = ajv.compile(z.toJSONSchema(cliOutputSchema));
    const output = {
      schema_version: "1",
      command: "status",
      ok: true,
      status: "degraded",
      data: {},
      diagnostics: [
        {
          code: "DIST-001",
          severity: "warning",
          message: "Unavailable",
          remediation: "Retry later",
          repairable: false,
        },
      ],
      meta: { cli_version: "0.0.0" },
    };
    expect(validate(output)).toBe(true);
    expect(cliOutputSchema.safeParse(output).success).toBe(true);
    const malformed = { ...output, diagnostics: [{ ...output.diagnostics[0], code: "unstable" }] };
    expect(validate(malformed)).toBe(false);
    expect(cliOutputSchema.safeParse(malformed).success).toBe(false);
  });
});
