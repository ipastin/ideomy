import { parentPort, workerData } from "node:worker_threads";
import { synchronizeVaultIndex } from "./vault-health.ts";

if (!parentPort) throw new Error("Vault inspector requires a worker parent.");
parentPort.postMessage(synchronizeVaultIndex(workerData as Parameters<typeof synchronizeVaultIndex>[0]));
