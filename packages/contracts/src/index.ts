import addFormats from "ajv-formats";
import { z } from "zod";

const validateDateTime = (addFormats.default.get("date-time", "full") as { validate: (value: string) => boolean })
  .validate;
const dateTime = z.string().refine(validateDateTime).meta({ format: "date-time" });
const object = z.record(z.string(), z.unknown());

export const cliOutputSchema = z.strictObject({
  schema_version: z.literal("1"),
  command: z.string(),
  ok: z.boolean(),
  status: z.enum(["healthy", "degraded", "failed"]),
  data: object,
  diagnostics: z.array(
    z.strictObject({
      code: z.string().regex(/^[A-Z]+-\d{3}$/),
      severity: z.enum(["info", "warning", "error", "fatal"]),
      message: z.string(),
      remediation: z.string(),
      repairable: z.boolean(),
    }),
  ),
  meta: z.strictObject({ cli_version: z.string() }),
});

export type CliDiagnostic = z.infer<typeof cliOutputSchema>["diagnostics"][number];

export const protocolSchemas = {
  health: z.strictObject({
    ok: z.literal(true),
    protocol: z.literal(1),
    core_instance_id: z.string(),
    status: z.literal("ready"),
  }),
  discovery: z.strictObject({
    instance_id: z.string(),
    protocol: z.literal(1),
    port: z.number().int().min(1).max(65535),
    pid: z.number().int().min(1),
    started_at: dateTime,
    vault_id: z.string(),
  }),
  "pair-request": z.strictObject({
    client_instance_id: z.string(),
    vault_id: z.string(),
    vault_fingerprint: z.string(),
    bootstrap_proof: z.string(),
    public_key: z.strictObject({
      kty: z.literal("EC"),
      crv: z.literal("P-256"),
      x: z.string(),
      y: z.string(),
    }),
  }),
  "pair-response": z.strictObject({ paired: z.literal(true) }),
  "pair-window-request": z.strictObject({}),
  "pair-window-response": z.strictObject({ bootstrap_proof: z.string(), expires_at: dateTime }),
  "auth-challenge-request": z.strictObject({
    client_instance_id: z.string(),
    vault_id: z.string(),
    vault_fingerprint: z.string(),
  }),
  "auth-challenge-response": z.strictObject({
    nonce_id: z.string(),
    nonce: z.string(),
    expires_at: dateTime,
  }),
  "auth-session-request": z.discriminatedUnion("client_type", [
    z.strictObject({
      client_type: z.literal("plugin"),
      client_instance_id: z.string(),
      vault_id: z.string(),
      vault_fingerprint: z.string(),
      nonce_id: z.string(),
      signature: z.string(),
    }),
    z.strictObject({
      client_type: z.literal("cli"),
      client_instance_id: z.string(),
      vault_id: z.string(),
      vault_fingerprint: z.string(),
    }),
  ]),
  "auth-session-response": z.strictObject({
    session_token: z.string(),
    expires_at: dateTime,
    core_instance_id: z.string(),
    vault_id: z.string(),
  }),
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

export type CoreDiscovery = z.infer<typeof protocolSchemas.discovery>;
export type HandshakeRequest = z.infer<(typeof protocolSchemas)["handshake-request"]>;
export type HandshakeResponse = z.infer<(typeof protocolSchemas)["handshake-response"]>;
export type CoreErrorEnvelope = z.infer<(typeof protocolSchemas)["error-envelope"]>;
