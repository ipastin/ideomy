import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { startCore } from "@ideomy/core";
import { readCliAdminSecret } from "@ideomy/platform";
import { afterEach, describe, expect, it } from "vitest";
import { CoreClient } from "./index.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("CoreClient Plugin P0 integration", () => {
  it("pairs a Plugin, authenticates it, and rejects another Vault", async () => {
    const stateDirectory = mkdtempSync(path.join(tmpdir(), "ideomy-core-client-"));
    directories.push(stateDirectory);
    let core = await startCore({ stateDirectory, vaultId: "vault_fixture", vaultFingerprint: "fixture-fingerprint" });
    try {
      const identity = {
        vaultId: "vault_fixture",
        vaultFingerprint: "fixture-fingerprint",
        clientInstanceId: "plugin_fixture",
        clientVersion: "0.0.0",
      };
      const discover = () => core.discovery;
      const cli = new CoreClient(discover);
      await cli.connectCli({ ...identity, clientInstanceId: "cli_fixture" }, readCliAdminSecret(stateDirectory));
      const window = await cli.openPairingWindow();
      const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const plugin = new CoreClient(discover);
      await plugin.pairPlugin(identity, keys.publicKey, window.bootstrap_proof);
      expect((await plugin.connectPlugin(identity, keys.privateKey)).vault_id).toBe(identity.vaultId);
      expect((await plugin.systemHealth()).vault.vault_id).toBe(identity.vaultId);

      const wrongVault = new CoreClient(discover);
      await expect(
        wrongVault.connectPlugin({ ...identity, vaultId: "vault_other" }, keys.privateKey),
      ).rejects.toMatchObject({ code: "VAULT-004" });

      await core.close();
      core = await startCore({
        stateDirectory,
        vaultId: identity.vaultId,
        vaultFingerprint: identity.vaultFingerprint,
      });
      expect((await plugin.connectPlugin(identity, keys.privateKey)).core_instance_id).toBe(core.discovery.instance_id);
    } finally {
      await core.close();
    }
  });
});
