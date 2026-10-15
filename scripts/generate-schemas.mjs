import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { protocolSchemas } from "../dist/packages/contracts/src/index.js";
import { entitySchemas, managedEntityBase } from "../dist/packages/schema/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function writeSchema(file, schema, id) {
  const target = path.join(root, "dist/generated", file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify({ ...z.toJSONSchema(schema), $id: id }, null, 2)}\n`);
}

writeSchema("schemas/base.schema.json", managedEntityBase, "https://ideomy.local/schema/base.schema.json");
for (const [name, schema] of Object.entries(entitySchemas)) {
  writeSchema(
    `schemas/entities/${name}.schema.json`,
    schema,
    `https://ideomy.local/schema/entities/${name}.schema.json`,
  );
}
for (const [name, schema] of Object.entries(protocolSchemas)) {
  writeSchema(
    `contracts/protocol/v1/${name}.schema.json`,
    schema,
    `https://ideomy.local/protocol/v1/${name}.schema.json`,
  );
}
console.log(
  `Generated 16 entity/base and ${Object.keys(protocolSchemas).length} protocol JSON Schemas in dist/generated`,
);
