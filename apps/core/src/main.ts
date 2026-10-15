#!/usr/bin/env node
import { coreStateDirectory, readCoreProfile } from "@ideomy/platform";
import { startCore } from "./index.ts";

async function main(): Promise<void> {
  const stateDirectory = coreStateDirectory();
  const profile = readCoreProfile(stateDirectory);
  const core = await startCore({
    stateDirectory,
    vaultId: profile.vault_id,
    vaultFingerprint: profile.vault_fingerprint,
  });
  const shutdown = async () => {
    await core.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch(() => {
  process.stderr.write("Ideomy Core could not start. Check machine-local profile and state permissions.\n");
  process.exitCode = 1;
});
