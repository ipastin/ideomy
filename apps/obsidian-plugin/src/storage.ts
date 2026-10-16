import { type CoreDiscovery, protocolSchemas } from "@ideomy/contracts";

export type Connection = {
  discovery: CoreDiscovery;
  vaultFingerprint: string;
  vaultPath: string;
};
export type LocalIdentity = { clientInstanceId: string; keys: CryptoKeyPair };

export function parseConnection(value: unknown): Connection {
  if (!value || typeof value !== "object") throw new Error("Invalid connection metadata.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["discovery", "vaultFingerprint", "vaultPath"].includes(key))) {
    throw new Error("Connection metadata must not contain credentials.");
  }
  if (typeof data.vaultFingerprint !== "string" || !data.vaultFingerprint) {
    throw new Error("Vault fingerprint is required.");
  }
  if (typeof data.vaultPath !== "string" || !data.vaultPath) throw new Error("Development Vault path is required.");
  return {
    discovery: protocolSchemas.discovery.parse(data.discovery),
    vaultFingerprint: data.vaultFingerprint,
    vaultPath: data.vaultPath,
  };
}

export class LocalStore {
  private database: Promise<IDBDatabase> | undefined;
  private closed = false;

  constructor(private readonly name = "ideomy-plugin-v1") {}

  private open(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new Error("Local key storage is closed."));
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("local");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Local key storage unavailable; re-pair through setup."));
    });
    return this.database;
  }

  async read<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("local", "readonly");
      const request = transaction.objectStore("local").get(key);
      transaction.oncomplete = () => resolve(request.result as T | undefined);
      transaction.onerror = () => reject(new Error("Unable to read local key storage."));
      transaction.onabort = () => reject(new Error("Local key storage read aborted."));
    });
  }

  async write(key: string, value: unknown): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("local", "readwrite");
      transaction.objectStore("local").put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("Unable to persist local key storage."));
      transaction.onabort = () => reject(new Error("Local key storage write aborted."));
    });
  }

  async identity(scope: string): Promise<LocalIdentity> {
    const key = `identity:${scope}`;
    const previous = await this.read<LocalIdentity>(key);
    if (previous) {
      if (previous.keys.privateKey.extractable) throw new Error("Unsafe local key; explicit re-pair required.");
      return previous;
    }
    const identity = {
      clientInstanceId: `plugin_${crypto.randomUUID()}`,
      keys: await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]),
    };
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("local", "readwrite");
      const store = transaction.objectStore("local");
      const request = store.get(key);
      let chosen: LocalIdentity = identity;
      request.onsuccess = () => {
        if (request.result) chosen = request.result as LocalIdentity;
        else store.put(identity, key);
      };
      transaction.oncomplete = () => {
        if (chosen.keys.privateKey.extractable) reject(new Error("Unsafe local key; explicit re-pair required."));
        else resolve(chosen);
      };
      transaction.onerror = () => reject(new Error("Unable to persist local key."));
      transaction.onabort = () => reject(new Error("Local key persistence aborted."));
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.database) (await this.database).close();
    this.database = undefined;
  }
}
