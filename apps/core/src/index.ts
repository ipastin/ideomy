import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { type CoreDiscovery, protocolSchemas } from "@ideomy/contracts";
import { readCliAdminSecret, readMachineLocalFile } from "@ideomy/platform";

type ClientType = "plugin" | "cli";
type PairedClient = {
  vault_id: string;
  vault_fingerprint: string;
  public_key: { kty: "EC"; crv: "P-256"; x: string; y: string };
};
type Session = { clientType: ClientType; clientId: string; vaultId: string; fingerprint: string; expiresAt: number };
type Challenge = { nonce: string; clientId: string; expiresAt: number };

export type CoreOptions = {
  stateDirectory: string;
  vaultId: string;
  vaultFingerprint: string;
  allowedOrigins?: string[];
};

export type RunningCore = {
  discovery: CoreDiscovery;
  revokeSession(token: string): void;
  close(): Promise<void>;
};

const random = (prefix: string) => `${prefix}_${randomBytes(24).toString("base64url")}`;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const sameSecret = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

function privateStateDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const state = lstatSync(directory);
  if (!state.isDirectory() || (process.platform !== "win32" && (state.mode & 0o077) !== 0)) {
    throw new Error("Core state directory is not private.");
  }
}

function writePrivateFile(directory: string, name: string, content: string): void {
  const target = path.join(directory, name);
  const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
  writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
  try {
    renameSync(temporary, target);
  } catch (error) {
    unlinkSync(temporary);
    throw error;
  }
}

function adminSecret(directory: string): string {
  const name = "core-admin.secret";
  const target = path.join(directory, name);
  if (!existsSync(target)) {
    const handle = openSync(target, "wx", 0o600);
    try {
      writeFileSync(handle, randomBytes(32).toString("base64url"));
    } finally {
      closeSync(handle);
    }
  }
  return readCliAdminSecret(directory);
}

function readPairedClients(directory: string): Map<string, PairedClient> {
  const target = path.join(directory, "paired-clients.json");
  if (!existsSync(target)) return new Map();
  const parsed: unknown = JSON.parse(readMachineLocalFile(directory, "paired-clients.json"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid paired client state.");
  const clients = new Map<string, PairedClient>();
  for (const [id, value] of Object.entries(parsed)) {
    const checked = protocolSchemas["pair-request"].safeParse({
      client_instance_id: id,
      bootstrap_proof: "stored",
      ...(value as object),
    });
    if (!checked.success) throw new Error("Invalid paired client state.");
    clients.set(id, {
      vault_id: checked.data.vault_id,
      vault_fingerprint: checked.data.vault_fingerprint,
      public_key: checked.data.public_key,
    });
  }
  return clients;
}

function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 32_768) throw new SyntaxError("Request body too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function startCore(options: CoreOptions): Promise<RunningCore> {
  if (!options.vaultId || !options.vaultFingerprint) throw new Error("Vault identity is required.");
  privateStateDirectory(options.stateDirectory);
  const admin = adminSecret(options.stateDirectory);
  writePrivateFile(
    options.stateDirectory,
    "core-profile.json",
    JSON.stringify({ vault_id: options.vaultId, vault_fingerprint: options.vaultFingerprint }),
  );
  const clients = readPairedClients(options.stateDirectory);
  const instanceId = random("core");
  const sessions = new Map<string, Session>();
  const challenges = new Map<string, Challenge>();
  const pairingRequests = new Map<string, { proof: string; expiresAt: number }>();
  const attempts = new Map<string, { since: number; count: number }>();
  let pairing: { proof: string; expiresAt: number } | undefined;

  const openPairingWindow = () => {
    pairing = { proof: randomBytes(32).toString("base64url"), expiresAt: Date.now() + 120_000 };
    return pairing;
  };

  const allowed = (bucket: string, limit: number): boolean => {
    const now = Date.now();
    for (const [id, challenge] of challenges) if (challenge.expiresAt <= now) challenges.delete(id);
    for (const [hash, session] of sessions) if (session.expiresAt <= now) sessions.delete(hash);
    for (const [key, request] of pairingRequests)
      if (request.expiresAt + 15 * 60_000 <= now) pairingRequests.delete(key);
    const state = attempts.get(bucket);
    if (!state || now - state.since >= 60_000) {
      attempts.set(bucket, { since: now, count: 1 });
      return true;
    }
    state.count++;
    return state.count <= limit;
  };

  const server = createServer(async (request, response) => {
    const requestId = /^[a-zA-Z0-9_-]{1,128}$/.test(String(request.headers["x-ideomy-request-id"] ?? ""))
      ? String(request.headers["x-ideomy-request-id"])
      : random("req");
    const error = (status: number, code: string, message: string) =>
      send(response, status, {
        ok: false,
        error: {
          code,
          category: code.startsWith("VAULT-") ? "vault" : "core",
          message,
          retryable: status >= 500,
          request_id: requestId,
          details: {},
        },
      });
    const vaultMatches = (vaultId: string, fingerprint: string) =>
      vaultId === options.vaultId && fingerprint === options.vaultFingerprint;
    const authorized = (): Session | undefined => {
      const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(request.headers.authorization ?? "");
      if (!match?.[1]) return undefined;
      const session = sessions.get(tokenHash(match[1]));
      if (!session || session.expiresAt <= Date.now()) return undefined;
      if (request.headers["x-ideomy-client"] !== session.clientType || request.headers["x-ideomy-protocol"] !== "1")
        return undefined;
      return session;
    };

    try {
      if (request.headers.origin && !options.allowedOrigins?.includes(request.headers.origin)) {
        error(403, "CORE-403", "Origin is not permitted.");
        return;
      }
      const route = new URL(request.url ?? "/", "http://localhost").pathname;
      if (request.method === "GET" && route === "/v1/health") {
        send(
          response,
          200,
          protocolSchemas.health.parse({ ok: true, protocol: 1, core_instance_id: instanceId, status: "ready" }),
        );
        return;
      }
      if (request.headers["x-ideomy-protocol"] !== "1" || !request.headers["x-ideomy-request-id"]) {
        error(400, "CORE-400", "Protocol and request ID headers are required.");
        return;
      }
      if (request.method === "POST" && route === "/v1/pair/request") {
        if (!allowed("pair", 10)) return error(429, "CORE-429", "Pairing rate limit exceeded.");
        const parsed = protocolSchemas["pair-request"].safeParse(await jsonBody(request));
        if (!parsed.success) return error(400, "CORE-400", "Invalid pairing request.");
        const data = parsed.data;
        if (!vaultMatches(data.vault_id, data.vault_fingerprint))
          return error(409, "VAULT-004", "Vault identity does not match the active Core profile.");
        if (!pairing || pairing.expiresAt <= Date.now() || !sameSecret(pairing.proof, data.bootstrap_proof))
          return error(401, "CORE-401", "Pairing is unavailable or proof is invalid.");
        try {
          createPublicKey({ key: data.public_key, format: "jwk" });
        } catch {
          return error(400, "CORE-400", "Invalid Plugin public key.");
        }
        const paired = {
          vault_id: data.vault_id,
          vault_fingerprint: data.vault_fingerprint,
          public_key: data.public_key,
        };
        writePrivateFile(
          options.stateDirectory,
          "paired-clients.json",
          JSON.stringify(Object.fromEntries(new Map([...clients, [data.client_instance_id, paired]]))),
        );
        clients.set(data.client_instance_id, paired);
        pairing = undefined;
        send(response, 200, protocolSchemas["pair-response"].parse({ paired: true }));
        return;
      }
      if (request.method === "POST" && route === "/v1/auth/challenge") {
        if (!allowed("challenge", 30)) return error(429, "CORE-429", "Authentication rate limit exceeded.");
        const parsed = protocolSchemas["auth-challenge-request"].safeParse(await jsonBody(request));
        if (!parsed.success) return error(400, "CORE-400", "Invalid challenge request.");
        const data = parsed.data;
        if (!vaultMatches(data.vault_id, data.vault_fingerprint))
          return error(409, "VAULT-004", "Vault identity does not match the active Core profile.");
        const paired = clients.get(data.client_instance_id);
        if (!paired || !vaultMatches(paired.vault_id, paired.vault_fingerprint))
          return error(401, "CORE-401", "Client is not paired.");
        const nonceId = random("nonce");
        const nonce = randomBytes(32).toString("base64url");
        const expiresAt = Date.now() + 60_000;
        challenges.set(nonceId, { nonce, clientId: data.client_instance_id, expiresAt });
        send(
          response,
          200,
          protocolSchemas["auth-challenge-response"].parse({
            nonce_id: nonceId,
            nonce,
            expires_at: new Date(expiresAt).toISOString(),
          }),
        );
        return;
      }
      if (request.method === "POST" && route === "/v1/auth/session") {
        if (!allowed("session", 30)) return error(429, "CORE-429", "Authentication rate limit exceeded.");
        const parsed = protocolSchemas["auth-session-request"].safeParse(await jsonBody(request));
        if (!parsed.success) return error(400, "CORE-400", "Invalid session request.");
        const data = parsed.data;
        if (!vaultMatches(data.vault_id, data.vault_fingerprint))
          return error(409, "VAULT-004", "Vault identity does not match the active Core profile.");
        if (data.client_type === "cli") {
          const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(request.headers.authorization ?? "");
          if (!match?.[1] || !sameSecret(admin, match[1])) return error(401, "CORE-401", "CLI authentication failed.");
        } else {
          const challenge = challenges.get(data.nonce_id);
          challenges.delete(data.nonce_id);
          const paired = clients.get(data.client_instance_id);
          if (
            !challenge ||
            challenge.clientId !== data.client_instance_id ||
            challenge.expiresAt <= Date.now() ||
            !paired ||
            paired.vault_id !== data.vault_id ||
            paired.vault_fingerprint !== data.vault_fingerprint
          )
            return error(401, "CORE-401", "Plugin authentication failed.");
          const key = createPublicKey({ key: paired.public_key, format: "jwk" });
          const valid = verify(
            "sha256",
            Buffer.from(challenge.nonce),
            { key, dsaEncoding: "ieee-p1363" },
            Buffer.from(data.signature, "base64url"),
          );
          if (!valid) return error(401, "CORE-401", "Plugin authentication failed.");
        }
        const token = randomBytes(32).toString("base64url");
        const expiresAt = Date.now() + 15 * 60_000;
        sessions.set(tokenHash(token), {
          clientType: data.client_type,
          clientId: data.client_instance_id,
          vaultId: data.vault_id,
          fingerprint: data.vault_fingerprint,
          expiresAt,
        });
        send(
          response,
          200,
          protocolSchemas["auth-session-response"].parse({
            session_token: token,
            expires_at: new Date(expiresAt).toISOString(),
            core_instance_id: instanceId,
            vault_id: options.vaultId,
          }),
        );
        return;
      }
      const session = authorized();
      if (!session) return error(401, "CORE-401", "An authenticated session is required.");
      if (!vaultMatches(session.vaultId, session.fingerprint))
        return error(409, "VAULT-004", "Vault identity does not match the active Core profile.");
      if (request.method === "POST" && route === "/v1/pair/window") {
        if (session.clientType !== "cli") return error(403, "CORE-403", "CLI session is required.");
        if (!protocolSchemas["pair-window-request"].safeParse(await jsonBody(request)).success)
          return error(400, "CORE-400", "Invalid pairing window request.");
        const key = request.headers["idempotency-key"];
        if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(key))
          return error(400, "CORE-400", "Idempotency-Key is required.");
        const identity = `${tokenHash(request.headers.authorization ?? "")}:${key}`;
        const window = pairingRequests.get(identity) ?? openPairingWindow();
        pairingRequests.set(identity, window);
        send(
          response,
          200,
          protocolSchemas["pair-window-response"].parse({
            bootstrap_proof: window.proof,
            expires_at: new Date(window.expiresAt).toISOString(),
          }),
        );
        return;
      }
      if (request.method === "POST" && route === "/v1/handshake") {
        const parsed = protocolSchemas["handshake-request"].safeParse(await jsonBody(request));
        if (!parsed.success) return error(400, "CORE-400", "Invalid handshake request.");
        const data = parsed.data;
        if (data.client_type !== session.clientType || data.client_instance_id !== session.clientId)
          return error(401, "CORE-401", "Client identity does not match session.");
        if (!vaultMatches(data.vault_id, data.vault_fingerprint))
          return error(409, "VAULT-004", "Vault identity does not match the active Core profile.");
        if (data.protocol_min > data.protocol_max) return error(400, "CORE-400", "Invalid protocol range.");
        const compatibility = data.protocol_min > 1 ? "core_update_required" : "compatible";
        send(
          response,
          200,
          protocolSchemas["handshake-response"].parse({
            core_version: "0.0.0",
            core_instance_id: instanceId,
            protocol: 1,
            vault_id: options.vaultId,
            vault_fingerprint: options.vaultFingerprint,
            capabilities: compatibility === "compatible" ? ["system-health"] : [],
            compatibility,
            schema_status: "unavailable",
            index_status: "unavailable",
            session_expires_at: new Date(session.expiresAt).toISOString(),
          }),
        );
        return;
      }
      if (request.method === "GET" && route === "/v1/system-health") {
        send(
          response,
          200,
          protocolSchemas.status.parse({
            status: "degraded",
            core: { status: "ready", instance_id: instanceId },
            vault: { status: "bound", vault_id: options.vaultId },
            schema: { status: "unavailable" },
            index: { status: "unavailable" },
          }),
        );
        return;
      }
      error(404, "CORE-404", "Endpoint is not available.");
    } catch (failure) {
      if (!response.headersSent) {
        if (failure instanceof SyntaxError) error(400, "CORE-400", "Request body is invalid.");
        else error(500, "CORE-500", "Core request failed.");
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Core loopback address is unavailable.");
  const discovery = protocolSchemas.discovery.parse({
    instance_id: instanceId,
    protocol: 1,
    port: address.port,
    pid: process.pid,
    started_at: new Date().toISOString(),
    vault_id: options.vaultId,
  });
  try {
    writePrivateFile(options.stateDirectory, "core-discovery.json", JSON.stringify(discovery));
  } catch (failure) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw failure;
  }
  return {
    discovery,
    revokeSession(token) {
      sessions.delete(tokenHash(token));
    },
    async close() {
      sessions.clear();
      challenges.clear();
      pairingRequests.clear();
      pairing = undefined;
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      const target = path.join(options.stateDirectory, "core-discovery.json");
      if (existsSync(target)) {
        const current = protocolSchemas.discovery.safeParse(JSON.parse(readFileSync(target, "utf8")));
        if (current.success && current.data.instance_id === instanceId) unlinkSync(target);
      }
    },
  };
}
