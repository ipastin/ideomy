import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { protocolSchemas } from "@ideomy/contracts";
import { type RunningCore, startCore } from "@ideomy/core";
import { CoreClient, CoreClientError } from "@ideomy/core-client";
import { readCliAdminSecret, readCoreDiscovery } from "@ideomy/platform";
import { describe, expect, it } from "vitest";

const vaultId = "vault_synthetic";
const fingerprint = "sha256:synthetic";
const identity = (clientInstanceId: string) => ({
  vaultId,
  vaultFingerprint: fingerprint,
  clientInstanceId,
  clientVersion: "0.1.0",
});

async function withCore(run: (core: RunningCore, directory: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), "ideomy-core-test-"));
  const core = await startCore({ stateDirectory: directory, vaultId, vaultFingerprint: fingerprint });
  try {
    await run(core, directory);
  } finally {
    await core.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

const request = (core: RunningCore, route: string, init: RequestInit = {}) =>
  fetch(`http://127.0.0.1:${core.discovery.port}${route}`, {
    ...init,
    headers: {
      "X-Ideomy-Protocol": "1",
      "X-Ideomy-Client": "cli",
      "X-Ideomy-Request-Id": "req_test",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

describe("M0.3 Core protocol", () => {
  it("discovers a dynamic loopback port and authenticates CLI while protecting sensitive reads", () =>
    withCore(async (core, directory) => {
      const discovery = protocolSchemas.discovery.parse(readCoreDiscovery(directory));
      expect(discovery).toEqual(core.discovery);
      expect(JSON.stringify(discovery)).not.toContain("secret");
      expect(statSync(path.join(directory, "core-admin.secret")).mode & 0o077).toBe(0);
      expect(statSync(path.join(directory, "core-discovery.json")).mode & 0o077).toBe(0);
      expect(statSync(path.join(directory, "core-instance.lock")).mode & 0o077).toBe(0);

      const preflight = await fetch(`http://127.0.0.1:${core.discovery.port}/v1/auth/session`, {
        method: "OPTIONS",
        headers: {
          Origin: "app://obsidian.md",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers":
            "authorization,content-type,x-ideomy-protocol,x-ideomy-client,x-ideomy-request-id",
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("app://obsidian.md");
      expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
      const corsHealth = await request(core, "/v1/health", { headers: { Origin: "app://obsidian.md" } });
      expect(corsHealth.headers.get("Access-Control-Allow-Origin")).toBe("app://obsidian.md");

      const noSession = await request(core, "/v1/system-health");
      expect(noSession.status).toBe(401);
      expect(protocolSchemas["error-envelope"].parse(await noSession.json()).error.code).toBe("CORE-401");

      const client = new CoreClient(() => readCoreDiscovery(directory));
      const handshake = await client.connectCli(identity("cli_test"), readCliAdminSecret(directory));
      expect(handshake).toMatchObject({ protocol: 1, compatibility: "compatible", vault_id: vaultId });
      expect((await client.systemHealth()).vault).toMatchObject({ vault_id: vaultId });

      const cli = spawn(
        process.execPath,
        [path.resolve(import.meta.dirname, "../apps/cli/src/index.ts"), "status", "--json"],
        {
          env: { ...process.env, IDEOMY_STATE_DIR: directory },
        },
      );
      const chunks: Buffer[] = [];
      const errors: Buffer[] = [];
      cli.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      cli.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
      const exitCode = await new Promise<number | null>((resolve) => cli.on("close", resolve));
      expect(exitCode, Buffer.concat(errors).toString("utf8")).toBe(0);
      const output = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      expect(output).toMatchObject({ command: "status", ok: true, data: { core: { status: "running" } } });
      expect(JSON.stringify(output)).not.toContain(readCliAdminSecret(directory));

      const wrong = new CoreClient(() => readCoreDiscovery(directory));
      await expect(
        wrong.connectCli({ ...identity("cli_wrong"), vaultFingerprint: "sha256:other" }, readCliAdminSecret(directory)),
      ).rejects.toMatchObject({ code: "VAULT-004" });
      const maliciousOrigin = await request(core, "/v1/health", { headers: { Origin: "https://example.test" } });
      expect(maliciousOrigin.status).toBe(403);
      const maliciousPreflight = await fetch(`http://127.0.0.1:${core.discovery.port}/v1/auth/session`, {
        method: "OPTIONS",
        headers: { Origin: "https://example.test", "Access-Control-Request-Method": "POST" },
      });
      expect(maliciousPreflight.status).toBe(403);
      if (process.platform !== "win32") {
        chmodSync(directory, 0o755);
        try {
          expect(() => readCliAdminSecret(directory)).toThrow("Core state directory is not private.");
        } finally {
          chmodSync(directory, 0o700);
        }
      }
    }));

  it("refuses a second Core instance without replacing active discovery or profile", () =>
    withCore(async (core, directory) => {
      const profile = readFileSync(path.join(directory, "core-profile.json"), "utf8");
      await expect(
        startCore({ stateDirectory: directory, vaultId: "vault_other", vaultFingerprint: "sha256:other" }),
      ).rejects.toThrow("Core state is already claimed.");
      expect(readCoreDiscovery(directory)).toEqual(core.discovery);
      expect(readFileSync(path.join(directory, "core-profile.json"), "utf8")).toBe(profile);
      const client = new CoreClient(() => readCoreDiscovery(directory));
      expect((await client.connectCli(identity("cli_single_instance"), readCliAdminSecret(directory))).vault_id).toBe(
        vaultId,
      );
    }));

  it("pairs a WebCrypto Plugin, rejects proof replay, and reconnects after Core restart", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "ideomy-core-restart-"));
    let core = await startCore({ stateDirectory: directory, vaultId, vaultFingerprint: fingerprint });
    try {
      const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
        "sign",
        "verify",
      ]);
      const plugin = new CoreClient(() => readCoreDiscovery(directory));
      const cli = new CoreClient(() => readCoreDiscovery(directory));
      await cli.connectCli(identity("cli_pairing"), readCliAdminSecret(directory));
      const window = await cli.openPairingWindow("pairing_test");
      expect(await cli.openPairingWindow("pairing_test")).toEqual(window);
      const invalidKey = await request(core, "/v1/pair/request", {
        method: "POST",
        headers: { "X-Ideomy-Client": "plugin" },
        body: JSON.stringify({
          client_instance_id: "plugin_test",
          vault_id: vaultId,
          vault_fingerprint: fingerprint,
          bootstrap_proof: window.bootstrap_proof,
          public_key: { kty: "EC", crv: "P-256", x: "invalid", y: "invalid" },
        }),
      });
      expect(invalidKey.status).toBe(400);
      await plugin.pairPlugin(identity("plugin_test"), keyPair.publicKey, window.bootstrap_proof);
      await expect(
        plugin.pairPlugin(identity("plugin_test"), keyPair.publicKey, window.bootstrap_proof),
      ).rejects.toMatchObject({
        code: "CORE-401",
      });
      const challengeResponse = await request(core, "/v1/auth/challenge", {
        method: "POST",
        headers: { "X-Ideomy-Client": "plugin" },
        body: JSON.stringify({
          client_instance_id: "plugin_test",
          vault_id: vaultId,
          vault_fingerprint: fingerprint,
        }),
      });
      const challenge = protocolSchemas["auth-challenge-response"].parse(await challengeResponse.json());
      const signature = Buffer.from(
        await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          keyPair.privateKey,
          new TextEncoder().encode(challenge.nonce),
        ),
      ).toString("base64url");
      const proof = JSON.stringify({
        client_type: "plugin",
        client_instance_id: "plugin_test",
        vault_id: vaultId,
        vault_fingerprint: fingerprint,
        nonce_id: challenge.nonce_id,
        signature,
      });
      const first = await request(core, "/v1/auth/session", {
        method: "POST",
        headers: { "X-Ideomy-Client": "plugin" },
        body: proof,
      });
      expect(first.status).toBe(200);
      const pluginSession = protocolSchemas["auth-session-response"].parse(await first.json());
      const forbiddenWindow = await request(core, "/v1/pair/window", {
        method: "POST",
        headers: {
          "X-Ideomy-Client": "plugin",
          Authorization: `Bearer ${pluginSession.session_token}`,
          "Idempotency-Key": "plugin_cannot_open",
        },
        body: "{}",
      });
      expect(forbiddenWindow.status).toBe(403);
      const replay = await request(core, "/v1/auth/session", {
        method: "POST",
        headers: { "X-Ideomy-Client": "plugin" },
        body: proof,
      });
      expect(replay.status).toBe(401);
      expect((await plugin.connectPlugin(identity("plugin_test"), keyPair.privateKey)).compatibility).toBe(
        "compatible",
      );
      expect((await plugin.systemHealth()).status).toBe("degraded");

      const firstInstance = core.discovery.instance_id;
      await core.close();
      core = await startCore({ stateDirectory: directory, vaultId, vaultFingerprint: fingerprint });
      expect(core.discovery.instance_id).not.toBe(firstInstance);
      await expect(plugin.systemHealth()).rejects.toBeInstanceOf(CoreClientError);
      expect((await plugin.connectPlugin(identity("plugin_test"), keyPair.privateKey)).core_instance_id).toBe(
        core.discovery.instance_id,
      );
      const restartedCli = new CoreClient(() => readCoreDiscovery(directory));
      expect(
        (await restartedCli.connectCli(identity("cli_reconnect"), readCliAdminSecret(directory))).compatibility,
      ).toBe("compatible");
    } finally {
      await core.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not authenticate a Plugin when saving its pairing fails", () =>
    withCore(async (core, directory) => {
      const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
        "sign",
        "verify",
      ]);
      const cli = new CoreClient(() => readCoreDiscovery(directory));
      const plugin = new CoreClient(() => readCoreDiscovery(directory));
      await cli.connectCli(identity("cli_failed_pair"), readCliAdminSecret(directory));
      const proof = (await cli.openPairingWindow()).bootstrap_proof;
      const blocker = path.join(directory, "paired-clients.json");
      mkdirSync(blocker);
      try {
        await expect(plugin.pairPlugin(identity("plugin_failed_pair"), keyPair.publicKey, proof)).rejects.toMatchObject(
          {
            code: "CORE-500",
          },
        );
        const challenge = await request(core, "/v1/auth/challenge", {
          method: "POST",
          headers: { "X-Ideomy-Client": "plugin" },
          body: JSON.stringify({
            client_instance_id: "plugin_failed_pair",
            vault_id: vaultId,
            vault_fingerprint: fingerprint,
          }),
        });
        expect(challenge.status).toBe(401);
        expect(readdirSync(directory).filter((name) => name.endsWith(".tmp"))).toEqual([]);
      } finally {
        rmSync(blocker, { recursive: true });
      }
      await plugin.pairPlugin(identity("plugin_failed_pair"), keyPair.publicKey, proof);
      expect((await plugin.connectPlugin(identity("plugin_failed_pair"), keyPair.privateKey)).compatibility).toBe(
        "compatible",
      );
    }));

  it("rejects challenge replay, revocation, and a mismatched protocol without exposing internals", () =>
    withCore(async (core, directory) => {
      const admin = readCliAdminSecret(directory);
      const sessionResponse = await request(core, "/v1/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${admin}` },
        body: JSON.stringify({
          client_type: "cli",
          client_instance_id: "cli_test",
          vault_id: vaultId,
          vault_fingerprint: fingerprint,
        }),
      });
      const session = protocolSchemas["auth-session-response"].parse(await sessionResponse.json());
      const mismatch = await request(core, "/v1/handshake", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session_token}` },
        body: JSON.stringify({
          client_type: "cli",
          client_version: "2.0.0",
          protocol_min: 2,
          protocol_max: 2,
          vault_id: vaultId,
          vault_fingerprint: fingerprint,
          client_instance_id: "cli_test",
        }),
      });
      expect(protocolSchemas["handshake-response"].parse(await mismatch.json()).compatibility).toBe(
        "core_update_required",
      );
      const forgedIdentity = await request(core, "/v1/handshake", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session_token}` },
        body: JSON.stringify({
          client_type: "cli",
          client_version: "0.1.0",
          protocol_min: 1,
          protocol_max: 1,
          vault_id: vaultId,
          vault_fingerprint: fingerprint,
          client_instance_id: "another_cli",
        }),
      });
      expect(forgedIdentity.status).toBe(401);
      core.revokeSession(session.session_token);
      const revoked = await request(core, "/v1/system-health", {
        headers: { Authorization: `Bearer ${session.session_token}` },
      });
      expect(revoked.status).toBe(401);
      const failure = protocolSchemas["error-envelope"].parse(await revoked.json());
      expect(failure.error).toMatchObject({ code: "CORE-401", request_id: "req_test" });
      expect(JSON.stringify(failure)).not.toContain(directory);
      const expiring = await request(core, "/v1/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${admin}` },
        body: JSON.stringify({
          client_type: "cli",
          client_instance_id: "cli_expiring",
          vault_id: vaultId,
          vault_fingerprint: fingerprint,
        }),
      });
      const expiringToken = protocolSchemas["auth-session-response"].parse(await expiring.json()).session_token;
      const oldNow = Date.now;
      Date.now = () => oldNow() + 16 * 60_000;
      try {
        const expired = await request(core, "/v1/system-health", {
          headers: { Authorization: `Bearer ${expiringToken}` },
        });
        expect(expired.status).toBe(401);
      } finally {
        Date.now = oldNow;
      }
      expect(readFileSync(path.join(directory, "core-admin.secret"), "utf8")).toBe(admin);
    }));

  it("starts as a separate process from machine-local profile and removes discovery on shutdown", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "ideomy-core-process-"));
    const seed = await startCore({ stateDirectory: directory, vaultId, vaultFingerprint: fingerprint });
    await seed.close();
    const processCore = spawn(process.execPath, [path.resolve(import.meta.dirname, "../apps/core/src/main.ts")], {
      env: { ...process.env, IDEOMY_STATE_DIR: directory },
    });
    const errors: Buffer[] = [];
    processCore.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    try {
      let discovery: ReturnType<typeof protocolSchemas.discovery.parse> | undefined;
      for (let attempt = 0; attempt < 400 && !discovery; attempt++) {
        try {
          discovery = protocolSchemas.discovery.parse(readCoreDiscovery(directory));
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
      expect(discovery, Buffer.concat(errors).toString("utf8")).toBeDefined();
      const client = new CoreClient(() => readCoreDiscovery(directory));
      expect((await client.connectCli(identity("cli_process"), readCliAdminSecret(directory))).vault_id).toBe(vaultId);
    } finally {
      processCore.kill("SIGTERM");
      if (processCore.exitCode === null) await new Promise((resolve) => processCore.once("close", resolve));
      rmSync(directory, { recursive: true, force: true });
    }
  }, 15_000);
});
