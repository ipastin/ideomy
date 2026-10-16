import type { HandshakeResponse } from "@ideomy/contracts";
import { CoreClient, CoreClientError } from "@ideomy/core-client";
import { type Connection, type LocalStore, parseConnection } from "./storage.ts";

export type ConnectionState = {
  state:
    | "missing"
    | "connecting"
    | "connected"
    | "stopped"
    | "incompatible"
    | "unpaired"
    | "wrong-vault"
    | "unavailable";
  message: string;
  handshake?: HandshakeResponse;
};

export class PluginConnection {
  state: ConnectionState = { state: "missing", message: "Run setup for the active Vault to connect Core." };
  private generation = 0;
  private active = true;
  private pending = false;
  private configuring = false;
  private readonly abort = new AbortController();
  private listeners = new Set<() => void>();

  constructor(
    private readonly scope: string,
    private readonly version: string,
    private readonly store: LocalStore,
    private readonly transport: typeof fetch = fetch,
    private readonly discover?: () => Promise<unknown | undefined>,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(state: ConnectionState): void {
    if (!this.active) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private checkActiveVault(connection: Connection): void {
    if (connection.vaultPath !== this.scope) {
      throw new CoreClientError("VAULT-004", "Development handoff belongs to another active Vault path.");
    }
  }

  async configure(value: unknown, proof: string): Promise<void> {
    if (!this.active || this.pending || this.configuring)
      throw new Error("Connection is already in progress or closed.");
    this.configuring = true;
    try {
      const connection = parseConnection(value);
      this.checkActiveVault(connection);
      await this.store.write(`connection:${this.scope}`, connection);
    } catch (error) {
      if (error instanceof CoreClientError && error.code === "VAULT-004") {
        this.update({
          state: "wrong-vault",
          message: "Development handoff belongs to another Vault. Generate a handoff for the active Vault.",
        });
      }
      throw error;
    } finally {
      this.configuring = false;
    }
    await this.connect(proof);
  }

  async connect(proof = ""): Promise<void> {
    if (!this.active || this.pending || this.configuring) return;
    this.pending = true;
    const generation = ++this.generation;
    const current = () => this.active && generation === this.generation;
    try {
      const previous = await this.store.read<Connection>(`connection:${this.scope}`);
      if (!current()) return;
      const discovered = await this.discover?.();
      if (!current()) return;
      const connection = discovered === undefined ? previous : discovered;
      if (!current()) return;
      if (connection === undefined) {
        this.update({ state: "missing", message: "Core connection is not configured. Run setup for this Vault." });
        return;
      }
      const checked = parseConnection(connection);
      this.checkActiveVault(checked);
      if (discovered !== undefined && previous) {
        const known = parseConnection(previous);
        this.checkActiveVault(known);
        // A new Core/Vault identity replaces a cached hint only after explicit pairing succeeds.
        if (
          (known.discovery.vault_id !== checked.discovery.vault_id ||
            known.vaultFingerprint !== checked.vaultFingerprint) &&
          !proof
        ) {
          throw new CoreClientError("VAULT-004", "Setup connection hint changed the active Vault identity.");
        }
      }
      if (this.state.state !== "connected") this.update({ state: "connecting", message: "Connecting to Core…" });
      // Native fetch must not receive PluginConnection as its `this` value.
      const transport = this.transport;
      const client = new CoreClient(
        () => checked.discovery,
        (input, init) =>
          transport(input, {
            ...init,
            signal: init?.signal ? AbortSignal.any([init.signal, this.abort.signal]) : this.abort.signal,
          }),
      );
      const cached = this.state.state === "connected" ? this.state.handshake : undefined;
      if (
        !proof &&
        cached?.core_instance_id === checked.discovery.instance_id &&
        cached.vault_id === checked.discovery.vault_id &&
        cached.vault_fingerprint === checked.vaultFingerprint &&
        Date.parse(cached.session_expires_at ?? "") > Date.now() + 60_000
      ) {
        await client.health();
        if (!current()) return;
        if (discovered !== undefined) await this.store.write(`connection:${this.scope}`, checked);
        return;
      }
      const local = await this.store.identity(
        `${this.scope}:${checked.discovery.vault_id}:${checked.vaultFingerprint}`,
      );
      if (!current()) return;
      const identity = {
        vaultId: checked.discovery.vault_id,
        vaultFingerprint: checked.vaultFingerprint,
        clientInstanceId: local.clientInstanceId,
        clientVersion: this.version,
      };
      if (proof) {
        await client.pairPlugin(identity, local.keys.publicKey, proof);
        proof = "";
      }
      if (!current()) return;
      const handshake = await client.connectPlugin(identity, local.keys.privateKey);
      const health = await client.systemHealth();
      if (!current()) return;
      // Cache setup hints only after Core authenticates the Vault identity.
      if (discovered !== undefined) await this.store.write(`connection:${this.scope}`, checked);
      if (current()) {
        this.update({
          state: "connected",
          handshake,
          message: `Authenticated Core connection. Foundation: ${health.status}; schema: ${handshake.schema_status ?? "unavailable"}; index: ${handshake.index_status ?? "unavailable"}.`,
        });
      }
    } catch (error) {
      if (!current()) return;
      const code = error instanceof CoreClientError ? error.code : "";
      const state =
        code === "CORE-426"
          ? "incompatible"
          : code === "VAULT-004"
            ? "wrong-vault"
            : code === "CORE-503"
              ? "stopped"
              : code === "CORE-401" || code === "CORE-403"
                ? "unpaired"
                : "unavailable";
      this.update({
        state,
        message:
          state === "unpaired"
            ? "unpaired. Enter the one-time pairing proof from setup."
            : `${state}. Run explicit setup/repair for the active Vault.`,
      });
    } finally {
      proof = "";
      this.pending = false;
    }
  }

  stop(): void {
    this.active = false;
    this.generation++;
    this.abort.abort();
    this.listeners.clear();
    void this.store.close().catch(() => {});
  }
}
