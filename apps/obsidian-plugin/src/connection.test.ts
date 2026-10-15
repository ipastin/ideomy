import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { PluginConnection } from "./connection.ts";
import { LocalStore, parseConnection } from "./storage.ts";

const discovery = {
  instance_id: "core_synthetic",
  protocol: 1,
  port: 31234,
  pid: 42,
  started_at: "2026-10-15T12:00:00Z",
  vault_id: "vault_synthetic",
};
const metadata = { discovery, vaultFingerprint: "synthetic-fingerprint", vaultPath: "/synthetic/one" };
const handshake = {
  core_version: "0.0.1",
  core_instance_id: discovery.instance_id,
  protocol: 1,
  vault_id: discovery.vault_id,
  vault_fingerprint: metadata.vaultFingerprint,
  capabilities: ["system-health"],
  compatibility: "compatible",
  schema_status: "unavailable",
  index_status: "unavailable",
};

function fixture(overrides: Record<string, unknown> = {}) {
  const requests: { route: string; body: Record<string, unknown> }[] = [];
  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const route = new URL(String(input)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ route, body });
    const values: Record<string, unknown> = {
      "/v1/health": { ok: true, protocol: 1, core_instance_id: discovery.instance_id, status: "ready" },
      "/v1/pair/request": { paired: true },
      "/v1/auth/challenge": { nonce_id: "nonce_1", nonce: "synthetic-nonce", expires_at: "2026-10-15T12:01:00Z" },
      "/v1/auth/session": {
        session_token: "synthetic-session",
        expires_at: "2026-10-15T12:15:00Z",
        core_instance_id: discovery.instance_id,
        vault_id: discovery.vault_id,
      },
      "/v1/handshake": handshake,
      "/v1/system-health": {
        status: "degraded",
        core: {},
        vault: {},
        schema: { status: "unavailable" },
        index: { status: "unavailable" },
      },
      ...overrides,
    };
    return Response.json(values[route]);
  });
  return { transport, requests };
}

describe("Plugin local credentials", () => {
  it("keeps a single identity when two windows initialize the same local scope", async () => {
    const name = crypto.randomUUID();
    const first = new LocalStore(name);
    const second = new LocalStore(name);
    const identities = await Promise.all([first.identity("/synthetic/shared"), second.identity("/synthetic/shared")]);
    expect(identities[0]?.clientInstanceId).toBe(identities[1]?.clientInstanceId);
    await first.close();
    await second.close();
  });
  it("persists a non-extractable key through reload and isolates active Vault scopes", async () => {
    const name = crypto.randomUUID();
    const first = new LocalStore(name);
    const identity = await first.identity("/synthetic/one");
    expect(identity.keys.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("jwk", identity.keys.privateKey)).rejects.toThrow();
    await first.close();
    const reopened = new LocalStore(name);
    expect((await reopened.identity("/synthetic/one")).clientInstanceId).toBe(identity.clientInstanceId);
    expect((await reopened.identity("/synthetic/two")).clientInstanceId).not.toBe(identity.clientInstanceId);
    await reopened.close();
  });

  it("rejects secrets in imported connection metadata", () => {
    expect(() => parseConnection({ ...metadata, bootstrap_proof: "synthetic-once" })).toThrow("credentials");
    expect(() => parseConnection({ ...metadata, discovery: { ...discovery, port: 0 } })).toThrow();
  });
});

describe("Plugin Core connection", () => {
  it("reads setup hints without manual JSON and refreshes Core port/instance with the same local identity", async () => {
    const store = new LocalStore(crypto.randomUUID());
    let hint = metadata;
    const { transport, requests } = fixture({
      "/v1/handshake": { ...handshake, session_expires_at: new Date(Date.now() + 900_000).toISOString() },
    });
    const discover = vi.fn(async () => hint);
    const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport, discover);
    await connection.connect("synthetic-once");
    expect(connection.state.state).toBe("connected");
    expect(connection.state.message).toContain("Foundation: degraded");
    const firstClient = requests.find((request) => request.route === "/v1/auth/challenge")?.body.client_instance_id;
    expect(firstClient).toBeTruthy();
    hint = {
      ...metadata,
      discovery: { ...discovery, instance_id: "core_restarted", port: 31235 },
    };
    const restarted = fixture({
      "/v1/health": { ok: true, protocol: 1, core_instance_id: "core_restarted", status: "ready" },
      "/v1/auth/session": {
        session_token: "synthetic-session-restarted",
        expires_at: "2026-10-15T12:15:00Z",
        core_instance_id: "core_restarted",
        vault_id: discovery.vault_id,
      },
      "/v1/handshake": { ...handshake, core_instance_id: "core_restarted" },
    });
    transport.mockImplementation(restarted.transport);
    await connection.connect();
    expect(connection.state.state).toBe("connected");
    expect(String(transport.mock.calls.at(-1)?.[0])).toContain(":31235/");
    expect(restarted.requests.find((request) => request.route === "/v1/auth/challenge")?.body.client_instance_id).toBe(
      firstClient,
    );
    expect(restarted.requests.some((request) => request.route === "/v1/pair/request")).toBe(false);
    expect(await store.read("connection:/synthetic/one")).toEqual(hint);
    expect(discover).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  it("polls live Core health without rescanning Vault through handshake and system health", async () => {
    const { transport, requests } = fixture({
      "/v1/handshake": { ...handshake, session_expires_at: new Date(Date.now() + 900_000).toISOString() },
    });
    const connection = new PluginConnection("/synthetic/one", "0.0.1", new LocalStore(crypto.randomUUID()), transport);
    await connection.configure(metadata, "");
    await connection.connect();
    expect(connection.state.state).toBe("connected");
    expect(requests.filter((entry) => entry.route === "/v1/handshake")).toHaveLength(1);
    expect(requests.filter((entry) => entry.route === "/v1/system-health")).toHaveLength(1);
    expect(requests.filter((entry) => entry.route === "/v1/health").length).toBeGreaterThan(1);
    connection.stop();
  });

  it("leaves connected state when the lightweight Core poll fails and reauthenticates on recovery", async () => {
    const { transport, requests } = fixture({
      "/v1/handshake": { ...handshake, session_expires_at: new Date(Date.now() + 900_000).toISOString() },
    });
    const connection = new PluginConnection("/synthetic/one", "0.0.1", new LocalStore(crypto.randomUUID()), transport);
    await connection.configure(metadata, "");
    transport.mockRejectedValueOnce(new Error("synthetic Core stop"));
    await connection.connect();
    expect(connection.state.state).toBe("stopped");
    await connection.connect();
    expect(connection.state.state).toBe("connected");
    expect(requests.filter((entry) => entry.route === "/v1/handshake")).toHaveLength(2);
    connection.stop();
  });

  it("rejects a setup hint for another Vault path or changed identity before network or persistence", async () => {
    for (const wrong of [
      { ...metadata, vaultPath: "/synthetic/two" },
      { ...metadata, vaultFingerprint: "another-fingerprint" },
      { ...metadata, discovery: { ...discovery, vault_id: "vault_another" } },
    ]) {
      const store = new LocalStore(crypto.randomUUID());
      await store.write("connection:/synthetic/one", metadata);
      const { transport } = fixture();
      const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport, async () => wrong);
      await connection.connect("synthetic-once");
      expect(connection.state.state).toBe("wrong-vault");
      expect(transport).not.toHaveBeenCalled();
      expect(await store.read("connection:/synthetic/one")).toEqual(metadata);
      connection.stop();
    }
  });

  it("reports malformed setup metadata as unavailable without connecting using stale metadata", async () => {
    const store = new LocalStore(crypto.randomUUID());
    await store.write("connection:/synthetic/one", metadata);
    const { transport } = fixture();
    const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport, async () => ({
      ...metadata,
      bootstrap_proof: "synthetic-secret",
    }));
    await connection.connect();
    expect(connection.state.state).toBe("unavailable");
    expect(transport).not.toHaveBeenCalled();
    expect(await store.read("connection:/synthetic/one")).toEqual(metadata);
    connection.stop();
  });

  it("does not pin a first setup hint whose authenticated handshake belongs to another Vault", async () => {
    const store = new LocalStore(crypto.randomUUID());
    const { transport } = fixture({ "/v1/handshake": { ...handshake, vault_fingerprint: "another-vault" } });
    const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport, async () => metadata);
    await connection.connect();
    expect(connection.state.state).toBe("wrong-vault");
    expect(await store.read("connection:/synthetic/one")).toBeUndefined();
    connection.stop();
  });

  it("suppresses a late setup hint after unload", async () => {
    let resolveHint: ((hint: unknown) => void) | undefined;
    const discover = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveHint = resolve;
        }),
    );
    const store = new LocalStore(crypto.randomUUID());
    const write = vi.spyOn(store, "write");
    const { transport } = fixture();
    const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport, discover);
    const pending = connection.connect();
    await vi.waitFor(() => expect(discover).toHaveBeenCalled());
    connection.stop();
    resolveHint?.(metadata);
    await pending;
    expect(write).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it("calls native-style fetch without binding it to PluginConnection", async () => {
    const { transport: reply } = fixture();
    const transport = vi.fn<typeof fetch>(function (this: unknown, input, init) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      return reply(input, init);
    });
    const connection = new PluginConnection("/synthetic/one", "0.0.1", new LocalStore(crypto.randomUUID()), transport);
    await connection.configure(metadata, "");
    expect(connection.state.state).toBe("connected");
    expect(transport).toHaveBeenCalled();
    connection.stop();
  });

  it("rejects a Vault B handoff in active Vault A before persisting or pairing", async () => {
    const store = new LocalStore(crypto.randomUUID());
    const { transport, requests } = fixture();
    const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport);
    await expect(
      connection.configure(
        { ...metadata, vaultPath: "/synthetic/two", discovery: { ...discovery, vault_id: "vault_b" } },
        "synthetic-proof-b",
      ),
    ).rejects.toThrow("another active Vault");
    expect(connection.state.state).toBe("wrong-vault");
    expect(await store.read("connection:/synthetic/one")).toBeUndefined();
    expect(requests).toHaveLength(0);
    expect(transport).not.toHaveBeenCalled();
    connection.stop();
  });

  it("rechecks persisted handoff path before any network call", async () => {
    const store = new LocalStore(crypto.randomUUID());
    await store.write("connection:/synthetic/one", { ...metadata, vaultPath: "/synthetic/two" });
    const { transport } = fixture();
    const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport);
    await connection.connect();
    expect(connection.state.state).toBe("wrong-vault");
    expect(transport).not.toHaveBeenCalled();
    connection.stop();
  });
  it("pairs once, stores no proof/session, reconnects with the same local key and reports degraded Foundation", async () => {
    const store = new LocalStore(crypto.randomUUID());
    const { transport, requests } = fixture();
    const connection = new PluginConnection("/synthetic/one", "0.0.1", store, transport);
    await connection.configure(metadata, "synthetic-once");
    expect(connection.state.state).toBe("connected");
    expect(connection.state.message).toContain("Foundation: degraded");
    expect(await store.read("connection:/synthetic/one")).toEqual(metadata);
    await connection.connect();
    expect(requests.filter((entry) => entry.route === "/v1/pair/request")).toHaveLength(1);
    expect(requests.filter((entry) => entry.route === "/v1/auth/session")).toHaveLength(2);
    expect(requests.find((entry) => entry.route === "/v1/auth/session")?.body.signature).toBeTruthy();
    const other = new PluginConnection("/synthetic/two", "0.0.1", store, transport);
    await other.connect();
    expect(other.state.state).toBe("missing");
    connection.stop();
    other.stop();
  });

  it("shows incompatible Core and wrong Vault explicitly", async () => {
    for (const [response, state] of [
      [{ ...handshake, compatibility: "unsupported" }, "incompatible"],
      [{ ...handshake, vault_fingerprint: "another-vault" }, "wrong-vault"],
    ] as const) {
      const connection = new PluginConnection(
        "/synthetic/one",
        "0.0.1",
        new LocalStore(crypto.randomUUID()),
        fixture({ "/v1/handshake": response }).transport,
      );
      await connection.configure(metadata, "");
      expect(connection.state.state).toBe(state);
      connection.stop();
    }
  });

  it("recovers from stopped Core when connection metadata is refreshed", async () => {
    const { transport } = fixture();
    transport.mockRejectedValueOnce(new Error("offline"));
    const connection = new PluginConnection("/synthetic/one", "0.0.1", new LocalStore(crypto.randomUUID()), transport);
    await connection.configure(metadata, "");
    expect(connection.state.state).toBe("stopped");
    await connection.configure({ ...metadata, discovery: { ...discovery, port: 31235 } }, "");
    expect(connection.state.state).toBe("connected");
    expect(String(transport.mock.calls.at(-1)?.[0])).toContain(":31235/");
    connection.stop();
  });

  it("refreshes discovery after Plugin reload and Core port change", async () => {
    const name = crypto.randomUUID();
    const { transport } = fixture();
    const first = new PluginConnection("/synthetic/one", "0.0.1", new LocalStore(name), transport);
    await first.configure(metadata, "");
    first.stop();

    const reloaded = new PluginConnection("/synthetic/one", "0.0.1", new LocalStore(name), transport);
    transport.mockRejectedValueOnce(new Error("offline"));
    await reloaded.connect();
    expect(reloaded.state.state).toBe("stopped");
    await reloaded.configure({ ...metadata, discovery: { ...discovery, port: 31235 } }, "");
    expect(reloaded.state.state).toBe("connected");
    expect(String(transport.mock.calls.at(-1)?.[0])).toContain(":31235/");
    reloaded.stop();
  });

  it("aborts in-flight requests and suppresses late UI updates after unload", async () => {
    const transport = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const connection = new PluginConnection("/synthetic/one", "0.0.1", new LocalStore(crypto.randomUUID()), transport);
    const listener = vi.fn();
    connection.subscribe(listener);
    const pending = connection.configure(metadata, "");
    await vi.waitFor(() => expect(transport).toHaveBeenCalled());
    connection.stop();
    const calls = listener.mock.calls.length;
    await pending;
    expect(listener).toHaveBeenCalledTimes(calls);
    expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
