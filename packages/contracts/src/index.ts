import addFormats from "ajv-formats";
import { z } from "zod";

const validateDateTime = (addFormats.default.get("date-time", "full") as { validate: (value: string) => boolean })
  .validate;
const rfc3339DateTime = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;
const dateTime = z.string().regex(rfc3339DateTime).refine(validateDateTime).meta({ format: "date-time" });
const object = z.record(z.string(), z.unknown());

export const protocolSchemas = {
  "handshake-request": z.strictObject({
    client_type: z.enum(["plugin", "cli"]),
    client_version: z.string(),
    protocol_min: z.number().int().min(1),
    protocol_max: z.number().int().min(1),
    vault_id: z.string(),
    vault_fingerprint: z.string(),
    client_instance_id: z.string(),
    platform: z.string().optional(),
    requested_capabilities: z.array(z.string()).optional(),
  }),
  "handshake-response": z.strictObject({
    core_version: z.string(),
    core_instance_id: z.string(),
    protocol: z.literal(1),
    vault_id: z.string(),
    vault_fingerprint: z.string(),
    capabilities: z.array(z.string()),
    compatibility: z.enum(["compatible", "client_update_required", "core_update_required", "unsupported"]),
    schema_status: z.string().optional(),
    index_status: z.string().optional(),
    session_expires_at: dateTime.nullable().optional(),
  }),
  "error-envelope": z.strictObject({
    ok: z.literal(false),
    error: z.strictObject({
      code: z.string(),
      category: z.string(),
      message: z.string(),
      retryable: z.boolean(),
      request_id: z.string(),
      details: object.optional(),
    }),
  }),
  operation: z.strictObject({
    operation_id: z.string(),
    state: z.enum(["queued", "running", "waiting_review", "completed", "failed", "cancelled"]),
    kind: z.string(),
    stage: z.string().nullable().optional(),
    progress: z.number().min(0).max(1).nullable().optional(),
    created_at: dateTime,
    updated_at: dateTime,
    result: z.unknown().optional(),
    error: z.unknown().optional(),
  }),
  "review-item": z.strictObject({
    id: z.string(),
    kind: z.string(),
    risk: z.enum(["low", "medium", "high"]),
    state: z.enum(["pending", "accepted", "rejected", "stale", "conflict"]),
    created_at: dateTime,
    entity_id: z.string().nullable().optional(),
    proposal: object,
    reason: z.string().nullable().optional(),
    base_hash: z.string().nullable().optional(),
  }),
  status: z.strictObject({
    status: z.enum(["healthy", "attention", "degraded", "unavailable"]),
    core: object,
    vault: object,
    schema: object,
    index: object,
    models: object.optional(),
  }),
} as const;
