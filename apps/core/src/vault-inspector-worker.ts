import { parentPort, workerData } from "node:worker_threads";
import { inspectVault } from "./vault-health.ts";

if (!parentPort) throw new Error("Vault inspector requires a worker parent.");
parentPort.postMessage(inspectVault(workerData as Parameters<typeof inspectVault>[0]));
