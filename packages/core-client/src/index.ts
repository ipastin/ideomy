import {
  type CoreDiscovery,
  type CoreErrorEnvelope,
  type HandshakeRequest,
  type HandshakeResponse,
  protocolSchemas,
} from "@ideomy/contracts";

export class CoreClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CoreClientError";
    this.code = code;
  }
}

type Discovery = () => Promise<unknown> | unknown;
type Identity = { vaultId: string; vaultFingerprint: string; clientInstanceId: string; clientVersion: string };

const base64url = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

export class CoreClient {
  private baseUrl = "";
  private token = "";
  private clientType: "cli" | "plugin" = "cli";
  private discovery?: CoreDiscovery;
  private readonly discover: Discovery;
  private readonly transport: typeof fetch;

  constructor(discover: Discovery, transport: typeof fetch = fetch) {
    this.discover = discover;
    this.transport = transport;
  }

  private async locate(): Promise<CoreDiscovery> {
    const record = protocolSchemas.discovery.parse(await this.discover());
    this.baseUrl = `http://127.0.0.1:${record.port}`;
    const health = protocolSchemas.health.parse(await this.request("GET", "/v1/health"));
    if (health.core_instance_id !== record.instance_id)
      throw new CoreClientError("CORE-409", "Core discovery is stale.");
    this.discovery = record;
    this.token = "";
    return record;
  }

  private async request(
    method: "GET" | "POST",
    route: string,
    body?: unknown,
    bearer?: string,
    idempotencyKey?: string,
  ): Promise<unknown> {
    const requestId = `req_${crypto.randomUUID()}`;
    const headers: Record<string, string> = {
      "X-Ideomy-Protocol": "1",
      "X-Ideomy-Client": this.clientType,
      "X-Ideomy-Request-Id": requestId,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json; charset=utf-8";
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    let response: Response;
    try {
      response = await this.transport(`${this.baseUrl}${route}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(route === "/v1/health" || route === "/v1/handshake" ? 2_000 : 5_000),
      });
    } catch {
      throw new CoreClientError("CORE-503", "Core is unavailable.");
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CoreClientError("CORE-502", "Core returned invalid JSON.");
    }
    if (!response.ok) {
      const parsed = protocolSchemas["error-envelope"].safeParse(payload);
      if (!parsed.success) throw new CoreClientError("CORE-502", "Core returned an invalid error envelope.");
      const failure: CoreErrorEnvelope = parsed.data;
      throw new CoreClientError(failure.error.code, failure.error.message);
    }
    return payload;
  }

  async health(): Promise<ReturnType<typeof protocolSchemas.health.parse>> {
    await this.locate();
    return protocolSchemas.health.parse(await this.request("GET", "/v1/health"));
  }

  async pairPlugin(identity: Identity, publicKey: CryptoKey, bootstrapProof: string): Promise<void> {
    this.clientType = "plugin";
    const discovery = await this.locate();
    if (discovery.vault_id !== identity.vaultId)
      throw new CoreClientError("VAULT-004", "Vault identity does not match discovery.");
    const jwk = await crypto.subtle.exportKey("jwk", publicKey);
    protocolSchemas["pair-response"].parse(
      await this.request("POST", "/v1/pair/request", {
        client_instance_id: identity.clientInstanceId,
        vault_id: identity.vaultId,
        vault_fingerprint: identity.vaultFingerprint,
        bootstrap_proof: bootstrapProof,
        public_key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      }),
    );
  }

  async connectPlugin(identity: Identity, privateKey: CryptoKey): Promise<HandshakeResponse> {
    this.clientType = "plugin";
    const discovery = await this.locate();
    if (discovery.vault_id !== identity.vaultId)
      throw new CoreClientError("VAULT-004", "Vault identity does not match discovery.");
    const challenge = protocolSchemas["auth-challenge-response"].parse(
      await this.request("POST", "/v1/auth/challenge", {
        client_instance_id: identity.clientInstanceId,
        vault_id: identity.vaultId,
        vault_fingerprint: identity.vaultFingerprint,
      }),
    );
    const signature = base64url(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        new TextEncoder().encode(challenge.nonce),
      ),
    );
    const session = protocolSchemas["auth-session-response"].parse(
      await this.request("POST", "/v1/auth/session", {
        client_type: "plugin",
        client_instance_id: identity.clientInstanceId,
        vault_id: identity.vaultId,
        vault_fingerprint: identity.vaultFingerprint,
        nonce_id: challenge.nonce_id,
        signature,
      }),
    );
    this.token = session.session_token;
    return this.handshake(identity);
  }

  async connectCli(identity: Identity, adminSecret: string): Promise<HandshakeResponse> {
    this.clientType = "cli";
    const discovery = await this.locate();
    if (discovery.vault_id !== identity.vaultId)
      throw new CoreClientError("VAULT-004", "Vault identity does not match discovery.");
    const session = protocolSchemas["auth-session-response"].parse(
      await this.request(
        "POST",
        "/v1/auth/session",
        {
          client_type: "cli",
          client_instance_id: identity.clientInstanceId,
          vault_id: identity.vaultId,
          vault_fingerprint: identity.vaultFingerprint,
        },
        adminSecret,
      ),
    );
    this.token = session.session_token;
    return this.handshake(identity);
  }

  private async handshake(identity: Identity): Promise<HandshakeResponse> {
    const request: HandshakeRequest = {
      client_type: this.clientType,
      client_version: identity.clientVersion,
      protocol_min: 1,
      protocol_max: 1,
      vault_id: identity.vaultId,
      vault_fingerprint: identity.vaultFingerprint,
      client_instance_id: identity.clientInstanceId,
      platform: "desktop",
      requested_capabilities: ["system-health"],
    };
    const response = protocolSchemas["handshake-response"].parse(
      await this.request("POST", "/v1/handshake", request, this.token),
    );
    if (response.compatibility !== "compatible")
      throw new CoreClientError("CORE-426", `Core protocol is ${response.compatibility}.`);
    if (response.vault_id !== identity.vaultId || response.vault_fingerprint !== identity.vaultFingerprint)
      throw new CoreClientError("VAULT-004", "Core response is bound to another Vault.");
    return response;
  }

  async systemHealth(): Promise<ReturnType<typeof protocolSchemas.status.parse>> {
    if (!this.token || !this.discovery) throw new CoreClientError("CORE-401", "Connect to Core first.");
    return protocolSchemas.status.parse(await this.request("GET", "/v1/system-health", undefined, this.token));
  }

  async openPairingWindow(
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ReturnType<(typeof protocolSchemas)["pair-window-response"]["parse"]>> {
    if (!this.token || this.clientType !== "cli") throw new CoreClientError("CORE-401", "CLI session is required.");
    return protocolSchemas["pair-window-response"].parse(
      await this.request("POST", "/v1/pair/window", {}, this.token, idempotencyKey),
    );
  }
}
