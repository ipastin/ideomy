import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoreClient, CoreClientError } from "@ideomy/core-client";
import {
  CoreStartupPendingError,
  coreStateDirectory,
  type EnvironmentSnapshot,
  inspectEnvironment,
  inspectSetupEnvironment,
  MacosCoreLifecycle,
  readCliAdminSecret,
  readCoreDiscovery,
  readCoreProfile,
  readMachineLocalFile,
} from "@ideomy/platform";
import { createVaultIdentity, deriveVaultFingerprint, generateEntityId, hashRaw } from "@ideomy/vault-io";
import {
  type BootstrapStage,
  bootstrapStages,
  type Diagnostic,
  type SetupOptions,
  type ShellResult,
  setupShell,
} from "./index.ts";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
type Lifecycle = Pick<MacosCoreLifecycle, "start" | "stop" | "restart" | "inspect"> &
  Partial<Pick<MacosCoreLifecycle, "repairStaleLock">>;
export type FoundationDependencies = {
  stateDirectory?: string;
  pluginDirectory?: string;
  templateDirectory?: string;
  coreEntrypoint?: string;
  environment?: EnvironmentSnapshot;
  lifecycle?: Lifecycle;
  runObsidian?: (args: string[]) => { ok: boolean; output: string };
  openVault?: (uri: string) => { ok: boolean; output: string };
  client?: CoreClient;
  vault?: string;
};
export type FoundationOptions = SetupOptions & {
  yes?: boolean;
  skipOpen?: boolean;
  skipIndex?: boolean;
  channel?: string;
  json?: boolean;
};
type State = {
  version: 1;
  vault_path: string;
  mode: "new" | "existing";
  completed_stages: BootstrapStage[];
  plugin_version: string;
  core_entrypoint: string;
  core_hash: string;
  plugin_hashes: Record<string, string>;
  index_verification_required: boolean;
  last_failure?: { stage: BootstrapStage; code: string };
};
class Failure extends Error {
  readonly code: string;
  readonly remediation: string;
  readonly exitCode: ShellResult["exitCode"];
  constructor(code: string, message: string, remediation: string, exitCode: ShellResult["exitCode"]) {
    super(message);
    this.code = code;
    this.remediation = remediation;
    this.exitCode = exitCode;
  }
}
const issue = (code: string, message: string, remediation: string): Diagnostic => ({
  code,
  message,
  remediation,
  severity: "error",
  repairable: false,
});
function safePath(target: string): void {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Failure(
        "VAULT-105",
        "A setup path contains a symlink.",
        "Use a resolved directory without symlinks.",
        20,
      );
  }
}
function directory(target: string, mode = 0o700): void {
  safePath(target);
  mkdirSync(target, { recursive: true, mode });
  if (!lstatSync(target).isDirectory())
    throw new Failure("VAULT-001", "Setup directory is invalid.", "Select an ordinary directory.", 20);
}
function write(target: string, content: string | Buffer, expected: Buffer | null): void {
  safePath(target);
  const old = existsSync(target) ? readFileSync(target) : null;
  if (old?.equals(Buffer.from(content))) return;
  if ((old === null) !== (expected === null) || (old && expected && !old.equals(expected)))
    throw new Failure("VAULT-409", "A setup file changed externally.", "Inspect the file and rerun setup.", 70);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, content, { flag: "wx", mode: 0o600 });
    const current = existsSync(target) ? readFileSync(target) : null;
    if ((current === null) !== (old === null) || (current && old && !current.equals(old)))
      throw new Failure("VAULT-409", "A setup file changed externally.", "Inspect the file and rerun setup.", 70);
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
function save(target: string, data: unknown): void {
  write(target, JSON.stringify(data), existsSync(target) ? readFileSync(target) : null);
}
function coreArtifactHash(entrypoint: string): string {
  const source = path.dirname(entrypoint);
  if (!source.endsWith(`${path.sep}apps${path.sep}core${path.sep}src`)) return hashRaw(readFileSync(entrypoint));
  const workspace = path.resolve(source, "../../..");
  // Development Core runtime closure; keep in sync with Core workspace dependency manifests.
  const runtimePackages = [
    "apps/core",
    "packages/contracts",
    "packages/platform",
    "packages/schema",
    "packages/vault-io",
  ];
  const files = [path.join(workspace, "pnpm-lock.yaml")];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Failure("CORE-002", "Core source contains a symlink.", "Restore the development Core artifacts.", 40);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) files.push(target);
    }
  };
  for (const name of runtimePackages) {
    const directory = path.join(workspace, name);
    files.push(path.join(directory, "package.json"));
    visit(path.join(directory, "src"));
  }
  return hashRaw(
    Buffer.from(
      JSON.stringify(files.sort().map((file) => [path.relative(workspace, file), hashRaw(readFileSync(file))])),
    ),
  );
}
function load(stateDirectory: string): State | undefined {
  if (!existsSync(path.join(stateDirectory, "bootstrap-state.json"))) return;
  const value = JSON.parse(readMachineLocalFile(stateDirectory, "bootstrap-state.json")) as State;
  if (
    value.version !== 1 ||
    typeof value.vault_path !== "string" ||
    !["new", "existing"].includes(value.mode) ||
    !Array.isArray(value.completed_stages) ||
    value.completed_stages.some((stage) => !bootstrapStages.includes(stage)) ||
    typeof value.core_entrypoint !== "string" ||
    typeof value.core_hash !== "string" ||
    typeof value.plugin_version !== "string"
  )
    throw new Failure(
      "CONFIG-001",
      "Bootstrap state is invalid.",
      "Inspect machine-local Bootstrap state before repair.",
      20,
    );
  return value;
}
function settings(input: FoundationDependencies) {
  const stateDirectory = path.resolve(input.stateDirectory ?? coreStateDirectory());
  const coreEntrypoint = path.resolve(input.coreEntrypoint ?? path.join(repository, "apps/core/src/main.ts"));
  return {
    ...input,
    stateDirectory,
    coreEntrypoint,
    pluginDirectory: path.resolve(input.pluginDirectory ?? path.join(repository, "apps/obsidian-plugin/dist")),
    templateDirectory: path.resolve(input.templateDirectory ?? path.join(repository, "vault-template")),
    environment: input.environment ?? inspectSetupEnvironment(),
    runObsidian:
      input.runObsidian ??
      ((args: string[]) => {
        const result = spawnSync("obsidian", args, { encoding: "utf8", timeout: 15_000 });
        return {
          ok: result.status === 0 && !/^(?:Error:|Vault not found\.)/m.test(result.stdout),
          output: result.stdout ?? "",
        };
      }),
    openVault:
      input.openVault ??
      ((uri: string) => {
        const result = spawnSync("/usr/bin/open", [uri], { encoding: "utf8", timeout: 15_000 });
        return { ok: result.status === 0, output: result.stderr ?? "" };
      }),
  };
}
function writable(root: string): void {
  safePath(root);
  if (!lstatSync(root).isDirectory() || (lstatSync(root).mode & 0o222) === 0)
    throw new Failure(
      "VAULT-002",
      "Vault is not writable.",
      "Grant write access to the selected Vault and rerun setup.",
      20,
    );
  accessSync(root, constants.R_OK | constants.W_OK | constants.X_OK);
}
function pluginFiles(root: string): string {
  return path.join(root, ".obsidian/plugins/ideomy");
}
function copyStarter(source: string, target: string): void {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name === "Templates") continue;
    const destination = path.join(target, entry.name);
    if (entry.isDirectory()) {
      directory(destination);
      copyStarter(path.join(source, entry.name), destination);
    } else if (entry.isFile()) {
      if (existsSync(destination)) continue;
      let content = readFileSync(path.join(source, entry.name), "utf8");
      if (entry.name === "Home.md")
        content = content
          .replace("sys_{{ULID}}", generateEntityId("system"))
          .replaceAll("{{NOW_ISO}}", new Date().toISOString());
      write(destination, content, null);
    } else
      throw new Failure(
        "DIST-001",
        "Starter contains an unsafe file.",
        "Restore the repository starter artifacts.",
        10,
      );
  }
}
function registeredVaultName(run: ReturnType<typeof settings>["runObsidian"], root: string): string {
  const vaults = run(["vaults", "verbose"]);
  const entries = vaults.output.split(/\r?\n/).map((line) => line.split("\t"));
  const entry = entries.find((parts) => {
    try {
      return parts.length === 2 && typeof parts[1] === "string" && realpathSync(parts[1]) === realpathSync(root);
    } catch {
      return false;
    }
  });
  if (!vaults.ok || !entry?.[0])
    throw new Failure(
      "OBS-004",
      "Selected Vault is not registered in Obsidian.",
      `In Obsidian choose Open folder as vault and select ${root}, then rerun the same setup command.`,
      10,
    );
  if (entries.filter((parts) => parts[0] === entry[0]).length !== 1)
    throw new Failure(
      "OBS-004",
      "Multiple registered Vaults share the selected Vault name.",
      "Use a unique Vault folder name in Obsidian, reopen it, then rerun setup.",
      10,
    );
  return entry[0];
}
function vaultCommand(run: ReturnType<typeof settings>["runObsidian"], root: string, args: string[]) {
  return run([`vault=${registeredVaultName(run, root)}`, ...args]);
}
function enabled(run: ReturnType<typeof settings>["runObsidian"], root: string, version: string): boolean {
  const result = vaultCommand(run, root, ["plugins:enabled", "filter=community", "versions"]);
  return result.ok && result.output.split(/\r?\n/).some((line) => line.trim() === `ideomy\t${version}`);
}
async function connect(config: ReturnType<typeof settings>) {
  const profile = readCoreProfile(config.stateDirectory);
  if (!profile.vault_path || deriveVaultFingerprint(profile.vault_path, profile.vault_id) !== profile.vault_fingerprint)
    throw new Failure(
      "VAULT-004",
      "Core Vault identity is invalid.",
      "Restore the selected Vault path; use explicit rebind for a moved Vault.",
      20,
    );
  const client = config.client ?? new CoreClient(() => readCoreDiscovery(config.stateDirectory));
  await client.connectCli(
    {
      vaultId: profile.vault_id,
      vaultFingerprint: profile.vault_fingerprint,
      clientInstanceId: "ideomy-bootstrap",
      clientVersion: "0.0.1",
    },
    readCliAdminSecret(config.stateDirectory),
  );
  return { client, profile, health: await client.systemHealth() };
}

export async function setupFoundation(
  options: FoundationOptions,
  dependencies: FoundationDependencies = {},
): Promise<ShellResult> {
  const config = settings(dependencies);
  let stage: BootstrapStage = "START";
  let state: State | undefined;
  let persistent = false;
  const complete = (value: BootstrapStage) => {
    if (!state) throw new Error("Bootstrap state must exist before stage completion.");
    state.completed_stages.push(value);
    save(path.join(config.stateDirectory, "bootstrap-state.json"), state);
  };
  try {
    const previous = load(config.stateDirectory);
    const mode = options.mode ?? previous?.mode;
    const vault = options.vault ?? previous?.vault_path;
    const preflight = setupShell(
      { ...(mode ? { mode } : {}), ...(vault ? { vault } : {}), nonInteractive: options.nonInteractive },
      config.environment,
    );
    if (preflight.data.stage !== "PLAN_MUTATIONS") return preflight;
    if (!mode || !vault) return preflight;
    stage = "PLAN_MUTATIONS";
    if (options.channel && options.channel !== "dev")
      throw new Failure(
        "DIST-001",
        "Only verified local development artifacts are available.",
        "Use --channel dev for this development build.",
        10,
      );
    const root = path.resolve(vault);
    safePath(root);
    if (previous && previous.vault_path !== root)
      throw new Failure(
        "VAULT-004",
        "Bootstrap is configured for a different Vault.",
        "Use a separate machine state directory or explicit rebind.",
        20,
      );
    const plan = {
      vault_path: root,
      mode,
      create: !existsSync(root),
      plugin: pluginFiles(root),
      core_entrypoint: config.coreEntrypoint,
      channel: "dev",
    };
    if (!options.yes)
      return {
        ok: false,
        status: "degraded",
        exitCode: 2,
        data: { stage, plan, confirmation_required: true },
        diagnostics: [
          issue(
            "CONFIG-001",
            "Confirm the displayed additive setup plan.",
            "Rerun with --yes after reviewing the selected paths.",
          ),
        ],
      };
    if (existsSync(root)) {
      writable(root);
      if (mode === "new" && !previous && readdirSync(root).length)
        throw new Failure(
          "VAULT-001",
          "New Vault directory is not empty.",
          "Use --existing or select an empty directory.",
          20,
        );
    } else if (mode === "existing")
      throw new Failure(
        "VAULT-001",
        "Existing Vault directory was not found.",
        "Select an existing Obsidian Vault.",
        20,
      );
    if (existsSync(path.join(config.stateDirectory, "core-profile.json"))) {
      const bound = readCoreProfile(config.stateDirectory);
      if (
        !existsSync(root) ||
        bound.vault_path !== realpathSync(root) ||
        bound.vault_fingerprint !== deriveVaultFingerprint(root, bound.vault_id)
      )
        throw new Failure(
          "VAULT-004",
          "Existing Core profile belongs to another Vault.",
          "Inspect Core profile; use explicit rebind before setup.",
          20,
        );
    }
    if (!existsSync(config.coreEntrypoint))
      throw new Failure("DIST-001", "Core development entrypoint is missing.", "Restore/build the Core artifacts.", 10);
    const candidateCoreHash = coreArtifactHash(config.coreEntrypoint);
    if (previous && (previous.core_entrypoint !== config.coreEntrypoint || previous.core_hash !== candidateCoreHash))
      throw new Failure(
        "CORE-002",
        "Installed Core artifact changed since the last setup.",
        "Run ideomy update --check; inspect the artifact before an explicit development reinstall.",
        40,
      );
    const manifest = JSON.parse(readFileSync(path.join(config.pluginDirectory, "manifest.json"), "utf8")) as {
      id: string;
      version: string;
    };
    if (manifest.id !== "ideomy" || typeof manifest.version !== "string")
      throw new Failure("PLUG-001", "Plugin manifest is invalid.", "Build the Ideomy development Plugin.", 30);
    const candidatePluginHashes = Object.fromEntries(
      ["main.js", "manifest.json"].map((name) => [
        name,
        hashRaw(readFileSync(path.join(config.pluginDirectory, name))),
      ]),
    );
    if (
      previous &&
      (previous.plugin_version !== manifest.version ||
        Object.entries(candidatePluginHashes).some(([name, hash]) => previous.plugin_hashes?.[name] !== hash))
    )
      throw new Failure(
        "PLUG-002",
        "Plugin artifact changed since the last setup.",
        "Run ideomy update --check; inspect the artifact before an explicit development reinstall.",
        30,
      );
    directory(config.stateDirectory);
    if ((lstatSync(config.stateDirectory).mode & 0o077) !== 0)
      throw new Failure(
        "CONFIG-001",
        "Core state directory is not private.",
        "Restrict the directory to its owner.",
        20,
      );
    state = {
      version: 1,
      vault_path: root,
      mode,
      completed_stages: bootstrapStages.slice(0, bootstrapStages.indexOf("PREPARE_VAULT")),
      plugin_version: manifest.version,
      core_entrypoint: config.coreEntrypoint,
      core_hash: candidateCoreHash,
      plugin_hashes: candidatePluginHashes,
      index_verification_required: options.skipIndex === true,
    };
    save(path.join(config.stateDirectory, "bootstrap-state.json"), state);
    persistent = true;
    stage = "PREPARE_VAULT";
    directory(root);
    writable(root);
    if (mode === "new") {
      copyStarter(config.templateDirectory, root);
      for (const folder of [
        "01 Inbox",
        "10 Projects",
        "11 Goals",
        "20 Knowledge",
        "21 Sources",
        "30 People",
        "31 Organizations",
        "32 Places",
        "40 Decisions",
        "41 Meetings",
        "42 Events",
        "43 Records",
        "50 Assets",
        "60 Journal",
        "80 Attachments",
        "90 Archive",
      ])
        directory(path.join(root, folder));
    }
    complete(stage);
    stage = "INSTALL_PLUGIN";
    vaultCommand(config.runObsidian, root, ["vault"]);
    const destination = pluginFiles(root);
    directory(destination);
    const installed = path.join(destination, "manifest.json");
    if (existsSync(installed)) {
      const current = JSON.parse(readFileSync(installed, "utf8")) as { id: string; version: string };
      if (current.id !== "ideomy" || current.version !== manifest.version)
        throw new Failure(
          "PLUG-002",
          "Installed Plugin version differs from the setup artifact.",
          "Run ideomy update --check; for a reviewed development artifact, uninstall Ideomy and rerun setup --existing for this Vault.",
          30,
        );
    }
    for (const name of ["main.js", "manifest.json"]) {
      const target = path.join(destination, name);
      const content = readFileSync(path.join(config.pluginDirectory, name));
      if (existsSync(target) && !readFileSync(target).equals(content))
        throw new Failure(
          "PLUG-002",
          "Installed Plugin artifact differs from the verified build.",
          "Run ideomy update --check; inspect the Plugin artifact before a reviewed reinstall.",
          30,
        );
      write(target, content, null);
    }
    if (!enabled(config.runObsidian, root, manifest.version)) {
      const restricted = vaultCommand(config.runObsidian, root, ["plugins:restrict"]);
      if (restricted.ok && restricted.output.trim() === "on")
        throw new Failure(
          "PLUG-003",
          "Community plugins are restricted in the selected Vault.",
          "Turn off Restricted mode in this Vault, then rerun setup.",
          30,
        );
      vaultCommand(config.runObsidian, root, ["reload"]);
      const enable = vaultCommand(config.runObsidian, root, ["plugin:enable", "id=ideomy"]);
      if (!enable.ok || !enabled(config.runObsidian, root, manifest.version))
        throw new Failure(
          "PLUG-003",
          "Obsidian did not enable the installed Plugin.",
          "Enable Community plugins and Ideomy in the selected Vault, then rerun setup.",
          30,
        );
    }
    complete(stage);
    stage = "INSTALL_CORE";
    const lifecycle =
      config.lifecycle ??
      new MacosCoreLifecycle({ stateDirectory: config.stateDirectory, entrypoint: config.coreEntrypoint });
    complete(stage);
    stage = "WRITE_CONFIG";
    const profileFile = path.join(config.stateDirectory, "core-profile.json");
    if (!existsSync(profileFile)) {
      const identity = createVaultIdentity(root);
      write(
        profileFile,
        JSON.stringify({
          vault_id: identity.vault_id,
          vault_fingerprint: identity.fingerprint,
          vault_path: realpathSync(root),
        }),
        null,
      );
    }
    const profile = readCoreProfile(config.stateDirectory);
    if (
      profile.vault_path !== realpathSync(root) ||
      profile.vault_fingerprint !== deriveVaultFingerprint(root, profile.vault_id)
    )
      throw new Failure(
        "VAULT-004",
        "Existing Core profile belongs to another Vault.",
        "Inspect Core profile; use explicit rebind before setup.",
        20,
      );
    complete(stage);
    stage = "START_CORE";
    try {
      await lifecycle.start();
    } catch (error) {
      if (error instanceof CoreStartupPendingError)
        return {
          ok: false,
          status: "degraded",
          exitCode: 90,
          data: { stage, completed_stages: state.completed_stages, resumable: true },
          diagnostics: [
            issue(
              "CORE-503",
              error.message,
              "Core is still starting. Inspect machine-local Core logs and rerun setup after discovery appears.",
            ),
          ],
        };
      throw new Failure(
        "CORE-503",
        "Core has not published a ready discovery.",
        `${error instanceof Error ? error.message : "Inspect machine-local Core logs."} Rerun setup when Core is ready; use ideomy repair for a diagnosed stale lock.`,
        90,
      );
    }
    complete(stage);
    stage = "VERIFY_HANDSHAKE";
    const connected = await connect(config);
    const connectionFile = path.join(destination, "connection.json");
    const metadata = {
      discovery: readCoreDiscovery(config.stateDirectory),
      vaultFingerprint: profile.vault_fingerprint,
      vaultPath: profile.vault_path,
    };
    if (existsSync(connectionFile)) {
      const current = JSON.parse(readFileSync(connectionFile, "utf8")) as Record<string, unknown>;
      if (current.vaultFingerprint !== metadata.vaultFingerprint || current.vaultPath !== metadata.vaultPath)
        throw new Failure(
          "VAULT-004",
          "Plugin connection belongs to another Vault.",
          "Inspect Plugin connection metadata before repair.",
          20,
        );
    }
    save(connectionFile, metadata);
    if (
      (connected.health.core as Record<string, unknown>).plugin_authenticated !== true ||
      (connected.health.core as Record<string, unknown>).plugin_handshake !== true
    ) {
      const proof = await connected.client.openPairingWindow();
      const result: ShellResult = {
        ok: false,
        status: "degraded",
        exitCode: 90,
        data: {
          stage,
          completed_stages: state.completed_stages,
          resumable: true,
          pairing_required: true,
          ...(!options.json ? { pairing_proof: proof.bootstrap_proof } : {}),
        },
        diagnostics: [
          issue(
            "PLUG-004",
            "Plugin pairing and authenticated handshake are required.",
            "Open Ideomy Connection in the selected Vault and enter the one-time proof shown by human setup, then rerun setup.",
          ),
        ],
      };
      state.last_failure = { stage, code: "PLUG-004" };
      try {
        save(path.join(config.stateDirectory, "bootstrap-state.json"), state);
      } catch {
        /* A disk failure must not conceal the failed stage. */
      }
      return result;
    }
    complete(stage);
    stage = "VALIDATE_VAULT";
    for (let attempt = 0; attempt < 120; attempt++) {
      if (
        (connected.health.schema as Record<string, unknown>).status !== "checking" &&
        (connected.health.index as Record<string, unknown>).status !== "checking"
      )
        break;
      if (attempt === 119)
        throw new Failure(
          "CORE-503",
          "Core is still checking the Vault.",
          "Rerun setup after the deterministic Vault scan completes.",
          90,
        );
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      connected.health = await connected.client.systemHealth();
    }
    if ((connected.health.schema as Record<string, unknown>).status !== "valid")
      throw new Failure(
        "SCHEMA-001",
        "Vault schema validation failed.",
        "Run ideomy doctor and correct the reported schema diagnostics.",
        50,
      );
    complete(stage);
    stage = "BUILD_INITIAL_INDEX";
    if (options.skipIndex)
      throw new Failure("INDEX-001", "Setup index verification was skipped.", "Rerun setup without --skip-index.", 90);
    if ((connected.health.index as Record<string, unknown>).status !== "current") {
      await lifecycle.restart();
      let refreshed = await connect(config);
      if ((refreshed.health.index as Record<string, unknown>).status !== "current")
        throw new Failure(
          "INDEX-001",
          "Initial deterministic index is not current.",
          "Inspect doctor diagnostics and rerun setup to retry indexing.",
          90,
        );
      for (let attempt = 0; attempt < 36; attempt++) {
        const core = refreshed.health.core as Record<string, unknown>;
        if (core.plugin_authenticated === true && core.plugin_handshake === true) break;
        if (attempt === 35)
          throw new Failure(
            "PLUG-004",
            "Plugin did not reconnect after Core restarted.",
            "Keep the selected Vault open in Obsidian and rerun setup after Plugin reconnects.",
            90,
          );
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        refreshed = await connect(config);
      }
    }
    complete(stage);
    stage = "RUN_DOCTOR";
    const doctor = await doctorFoundation(config);
    if (!doctor.ok)
      throw new Failure(
        doctor.diagnostics[0]?.code ?? "CORE-503",
        "Bootstrap doctor prerequisites are incomplete.",
        doctor.diagnostics[0]?.remediation ?? "Run ideomy doctor.",
        90,
      );
    complete(stage);
    stage = "OPEN_VAULT";
    if (
      !options.skipOpen &&
      !config.openVault(`obsidian://open?vault=${encodeURIComponent(registeredVaultName(config.runObsidian, root))}`).ok
    )
      throw new Failure(
        "OBS-004",
        "Obsidian could not open the selected Vault.",
        "Open the registered Vault and rerun setup.",
        10,
      );
    complete(stage);
    complete("DONE");
    return {
      ...doctor,
      data: { ...doctor.data, stage: "DONE", completed_stages: state.completed_stages, resumable: false },
    };
  } catch (error) {
    const failure =
      error instanceof Failure
        ? error
        : new Failure(
            error instanceof CoreClientError ? error.code : "SETUP-001",
            "Bootstrap could not complete the current stage.",
            "Inspect local installation paths and permissions; rerun setup after correcting the issue.",
            90,
          );
    if (persistent && state) {
      state.last_failure = { stage, code: failure.code };
      try {
        save(path.join(config.stateDirectory, "bootstrap-state.json"), state);
      } catch {
        /* A disk failure must not conceal the failed stage. */
      }
    }
    return {
      ok: false,
      status: "failed",
      exitCode: failure.exitCode,
      data: { stage, completed_stages: state?.completed_stages ?? [], resumable: true },
      diagnostics: [issue(failure.code, failure.message, failure.remediation)],
    };
  }
}

export async function doctorFoundation(dependencies: FoundationDependencies = {}): Promise<ShellResult> {
  const config = settings(dependencies);
  try {
    const state = load(config.stateDirectory);
    if (!state) throw new Failure("CONFIG-001", "Bootstrap configuration is missing.", "Run ideomy setup.", 20);
    if (config.vault && realpathSync(config.vault) !== realpathSync(state.vault_path))
      throw new Failure(
        "VAULT-004",
        "Requested Vault differs from configured Bootstrap Vault.",
        "Select the configured Vault or explicitly rebind.",
        20,
      );
    const preflight = setupShell(
      { mode: state.mode, vault: state.vault_path, nonInteractive: true },
      config.environment,
    );
    if (preflight.data.stage !== "PLAN_MUTATIONS") return preflight;
    writable(state.vault_path);
    if (!existsSync(state.core_entrypoint) || coreArtifactHash(state.core_entrypoint) !== state.core_hash)
      throw new Failure(
        "CORE-002",
        "Installed Core artifact changed.",
        "Run ideomy update --check; inspect the development Core artifact before a reviewed reinstall.",
        40,
      );
    const installed = pluginFiles(state.vault_path);
    safePath(installed);
    const manifest = JSON.parse(readFileSync(path.join(installed, "manifest.json"), "utf8")) as { version: string };
    for (const name of ["main.js", "manifest.json"]) {
      const target = path.join(installed, name);
      safePath(target);
      if (hashRaw(readFileSync(target)) !== state.plugin_hashes?.[name])
        throw new Failure(
          "PLUG-002",
          "Installed Plugin integrity does not match setup.",
          "Run ideomy update --check; inspect Plugin changes before a reviewed reinstall.",
          30,
        );
    }
    if (
      manifest.version !== state.plugin_version ||
      !enabled(config.runObsidian, state.vault_path, state.plugin_version)
    )
      throw new Failure(
        "PLUG-003",
        "Plugin is disabled or has an incompatible version.",
        "Enable the expected Plugin version in the selected Vault.",
        30,
      );
    const { health } = await connect(config);
    const authenticated =
      (health.core as Record<string, unknown>).plugin_authenticated === true &&
      (health.core as Record<string, unknown>).plugin_handshake === true &&
      (health.core as Record<string, unknown>).plugin_paired === true;
    const healthy = health.status === "healthy" && authenticated && !state.index_verification_required;
    return {
      ok: healthy,
      status: healthy ? "healthy" : "degraded",
      exitCode: healthy ? 0 : 90,
      data: {
        vault: { path: state.vault_path, ...health.vault },
        plugin: { version: manifest.version, enabled: true, authenticated },
        core: health.core,
        schema: health.schema,
        index: health.index,
        models: { status: "optional" },
      },
      diagnostics: healthy
        ? []
        : [
            issue(
              authenticated ? "INDEX-001" : "PLUG-004",
              authenticated
                ? "Deterministic Vault health is incomplete."
                : "Plugin authenticated handshake has not been verified.",
              "Run ideomy setup to resume the first unsatisfied prerequisite.",
            ),
          ],
    };
  } catch (error) {
    const failure =
      error instanceof Failure
        ? error
        : new Failure(
            error instanceof CoreClientError ? error.code : "CONFIG-001",
            "Installed Foundation state could not be verified.",
            "Run ideomy setup to inspect and resume installation.",
            90,
          );
    return {
      ok: false,
      status: "failed",
      exitCode: failure.exitCode,
      data: { core: { status: "unavailable" }, schema: { status: "unavailable" }, index: { status: "unavailable" } },
      diagnostics: [issue(failure.code, failure.message, failure.remediation)],
    };
  }
}
export async function statusFoundation(dependencies: FoundationDependencies = {}): Promise<ShellResult> {
  const config = settings({ ...dependencies, environment: dependencies.environment ?? inspectEnvironment() });
  try {
    const state = load(config.stateDirectory);
    if (!state) {
      // A pre-Foundation Core can still be running; status must preserve its M0.3 read path.
      try {
        const profile = readCoreProfile(config.stateDirectory);
        const client = config.client ?? new CoreClient(() => readCoreDiscovery(config.stateDirectory));
        const handshake = await client.connectCli(
          {
            vaultId: profile.vault_id,
            vaultFingerprint: profile.vault_fingerprint,
            clientInstanceId: `cli_${process.pid}`,
            clientVersion: "0.0.0",
          },
          readCliAdminSecret(config.stateDirectory),
        );
        const health = await client.systemHealth();
        return {
          ok: true,
          status: "degraded",
          exitCode: 0,
          data: {
            vault: health.vault,
            plugin: { status: "unavailable" },
            core: { status: "running", version: handshake.core_version },
            schema: health.schema,
            index: health.index,
          },
          diagnostics: [],
        };
      } catch {
        return {
          ok: true,
          status: "degraded",
          exitCode: 0,
          data: {
            vault: { status: "unavailable" },
            plugin: { status: "unavailable" },
            core: { status: "unavailable" },
            schema: { status: "unknown" },
            index: { status: "unknown" },
          },
          diagnostics: [],
        };
      }
    }
    if (config.vault && realpathSync(config.vault) !== realpathSync(state.vault_path))
      throw new Failure(
        "VAULT-004",
        "Requested Vault differs from configured Bootstrap Vault.",
        "Select the configured Vault or explicitly rebind.",
        20,
      );
    const client = config.client ?? new CoreClient(() => readCoreDiscovery(config.stateDirectory));
    let running = false;
    try {
      running = (await client.health()).status === "ready";
    } catch {
      /* A fast summary never repairs Core. */
    }
    const manifestPath = path.join(pluginFiles(state.vault_path), "manifest.json");
    safePath(manifestPath);
    const manifest = existsSync(manifestPath)
      ? (JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string })
      : undefined;
    return {
      ok: true,
      status: "degraded",
      exitCode: 0,
      data: {
        vault: { path: state.vault_path },
        plugin: {
          status: manifest ? "installed" : "unavailable",
          version: manifest?.version ?? "unknown",
          enabled: "unknown",
        },
        core: { status: running ? "running" : "stopped" },
        schema: { status: "unknown", reason: "Run doctor for current validation." },
        index: {
          status: existsSync(path.join(config.stateDirectory, "bootstrap-index.json")) ? "unknown" : "missing",
          reason: "Run doctor to verify freshness.",
        },
      },
      diagnostics: [],
    };
  } catch {
    return {
      ok: true,
      status: "degraded",
      exitCode: 0,
      data: { core: { status: "unavailable" }, schema: { status: "unknown" }, index: { status: "unknown" } },
      diagnostics: [issue("CONFIG-001", "Installed state cannot be inspected.", "Run ideomy doctor.")],
    };
  }
}
export async function updateFoundation(
  options: { channel?: string; check?: boolean } = {},
  dependencies: FoundationDependencies = {},
): Promise<ShellResult> {
  if (options.channel && options.channel !== "dev")
    return {
      ok: false,
      status: "degraded",
      exitCode: 80,
      data: { channel: options.channel },
      diagnostics: [
        issue(
          "DIST-001",
          "No verified release metadata is available for this channel.",
          "Use --channel dev for local artifact inspection.",
        ),
      ],
    };
  const config = settings(dependencies);
  try {
    const state = load(config.stateDirectory);
    if (!state) throw new Failure("CONFIG-001", "Bootstrap state is missing.", "Run ideomy setup.", 20);
    for (const name of ["main.js", "manifest.json"]) {
      const installed = path.join(pluginFiles(state.vault_path), name);
      safePath(installed);
      if (!existsSync(installed) || hashRaw(readFileSync(installed)) !== state.plugin_hashes[name])
        throw new Failure(
          "PLUG-002",
          "Installed Plugin differs from the recorded artifact.",
          "Inspect the installed Plugin before updating.",
          30,
        );
    }
    const candidateManifest = JSON.parse(readFileSync(path.join(config.pluginDirectory, "manifest.json"), "utf8")) as {
      id?: string;
      version?: string;
    };
    if (candidateManifest.id !== "ideomy" || !candidateManifest.version)
      throw new Failure(
        "DIST-001",
        "Candidate Plugin manifest is invalid.",
        "Build a verified Ideomy Plugin artifact.",
        80,
      );
    const pluginChanged = (["main.js", "manifest.json"] as const).some(
      (name) => hashRaw(readFileSync(path.join(config.pluginDirectory, name))) !== state.plugin_hashes[name],
    );
    const coreChanged = coreArtifactHash(state.core_entrypoint) !== state.core_hash;
    const changes = [pluginChanged && "plugin", coreChanged && "core"].filter(Boolean);
    // shortcut: the development channel inspects artifacts; add in-place swaps with a verified release channel.
    return {
      ok: options.check === true || changes.length === 0,
      status: changes.length ? "degraded" : "healthy",
      exitCode: changes.length && !options.check ? 80 : 0,
      data: {
        channel: "dev",
        check_only: true,
        installed_plugin_version: state.plugin_version,
        candidate_plugin_version: candidateManifest.version,
        changes,
      },
      diagnostics:
        changes.length && !options.check
          ? [
              issue(
                "DIST-001",
                "In-place development update is unavailable.",
                `Review the plan, then run ideomy uninstall --yes followed by ideomy setup --existing --vault '${state.vault_path.replaceAll("'", "'\\''")}' --yes. The Vault is preserved; Plugin pairing must be repeated.`,
              ),
            ]
          : [],
    };
  } catch (error) {
    const failure =
      error instanceof Failure
        ? error
        : new Failure(
            "DIST-001",
            "Update artifacts cannot be inspected.",
            "Restore the local development artifacts and retry --check.",
            80,
          );
    return {
      ok: false,
      status: "failed",
      exitCode: failure.exitCode,
      data: { channel: "dev", check_only: true },
      diagnostics: [issue(failure.code, failure.message, failure.remediation)],
    };
  }
}
export async function repairFoundation(
  options: {
    yes?: boolean;
    onPlan?: (plan: { vault_path: string; actions: string[]; vault_preserved: true }) => void;
  } = {},
  dependencies: FoundationDependencies = {},
): Promise<ShellResult> {
  const config = settings(dependencies);
  try {
    const state = load(config.stateDirectory);
    if (!state) throw new Failure("CONFIG-001", "Bootstrap state is missing.", "Run ideomy setup.", 20);
    if (!existsSync(state.core_entrypoint) || coreArtifactHash(state.core_entrypoint) !== state.core_hash)
      throw new Failure(
        "CORE-002",
        "Installed Core artifact changed.",
        "Inspect ideomy update --check before an explicit development reinstall.",
        40,
      );
    const lifecycle =
      config.lifecycle ??
      new MacosCoreLifecycle({ stateDirectory: config.stateDirectory, entrypoint: state.core_entrypoint });
    const before = await doctorFoundation(config);
    const coreState = lifecycle.inspect().state;
    const code = before.diagnostics[0]?.code;
    const indexStatus = (before.data.index as { status?: string } | undefined)?.status;
    const actions: ("repair_stale_lock" | "start_core" | "rebuild_index")[] = [];
    if (coreState === "stale" && code === "CORE-503") actions.push("repair_stale_lock", "start_core");
    else if (coreState === "stopped" && code === "CORE-503") actions.push("start_core");
    else if (
      coreState === "running" &&
      code === "INDEX-001" &&
      !state.index_verification_required &&
      ["stale", "missing"].includes(indexStatus ?? "")
    )
      actions.push("rebuild_index");
    const plan = { vault_path: state.vault_path, actions, vault_preserved: true as const };
    if (!actions.length) return { ...before, data: { ...before.data, plan } };
    if (!options.yes)
      return {
        ok: false,
        status: "degraded",
        exitCode: 2,
        data: { diagnosis: before.diagnostics, plan, confirmation_required: true },
        diagnostics: [
          {
            ...issue("CONFIG-001", "Review the displayed repair plan.", "Rerun ideomy repair --yes to apply it."),
            repairable: true,
          },
        ],
      };
    options.onPlan?.(plan);
    const current = load(config.stateDirectory);
    if (!current || current.core_hash !== state.core_hash || current.vault_path !== state.vault_path)
      throw new Failure(
        "CONFIG-001",
        "Repair preconditions changed.",
        "Run ideomy repair again to review a new plan.",
        20,
      );
    if (actions.includes("repair_stale_lock")) {
      if (!lifecycle.repairStaleLock)
        throw new Failure("CORE-002", "Stale-lock repair is unavailable.", "Use the macOS lifecycle adapter.", 40);
      lifecycle.repairStaleLock();
    }
    if (actions.includes("start_core")) await lifecycle.start();
    if (actions.includes("rebuild_index")) await lifecycle.restart();
    let after = await doctorFoundation(config);
    if (actions.includes("start_core") || actions.includes("rebuild_index")) {
      for (let attempt = 0; attempt < 36 && !after.ok; attempt++) {
        if (!["PLUG-004", "INDEX-001"].includes(after.diagnostics[0]?.code ?? "")) break;
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        after = await doctorFoundation(config);
      }
    }
    return { ...after, data: { ...after.data, plan, actions_applied: actions } };
  } catch (error) {
    const failure =
      error instanceof Failure
        ? error
        : new Failure(
            "CORE-002",
            "Explicit repair could not establish safe Core state.",
            "Inspect Core process identity and installation before retrying.",
            90,
          );
    return {
      ok: false,
      status: "failed",
      exitCode: failure.exitCode,
      data: { resumable: true },
      diagnostics: [issue(failure.code, failure.message, failure.remediation)],
    };
  }
}
export async function uninstallFoundation(dependencies: FoundationDependencies = {}): Promise<ShellResult> {
  const config = settings(dependencies);
  try {
    const state = load(config.stateDirectory);
    if (!state)
      return {
        ok: true,
        status: "degraded",
        exitCode: 0,
        data: { vault_preserved: true, already_uninstalled: true },
        diagnostics: [],
      };
    const lifecycle =
      config.lifecycle ??
      new MacosCoreLifecycle({ stateDirectory: config.stateDirectory, entrypoint: state.core_entrypoint });
    const stopped = await lifecycle.stop();
    if (stopped.state === "stale") {
      if (!lifecycle.repairStaleLock)
        throw new Failure(
          "CORE-002",
          "Stopped Core lock cannot be safely cleared.",
          "Use explicit lifecycle repair before uninstall.",
          40,
        );
      lifecycle.repairStaleLock();
    }
    const target = pluginFiles(state.vault_path);
    safePath(target);
    if (existsSync(path.join(target, "manifest.json"))) {
      const disabled = vaultCommand(config.runObsidian, state.vault_path, ["plugin:disable", "id=ideomy"]);
      if (!disabled.ok && !/^Error: Plugin "ideomy" is already disabled\.$/m.test(disabled.output))
        throw new Failure(
          "PLUG-003",
          "Plugin could not be disabled.",
          "Disable Ideomy in Obsidian before retrying uninstall.",
          30,
        );
    }
    for (const name of ["main.js", "manifest.json"]) {
      const file = path.join(target, name);
      safePath(file);
      if (existsSync(file) && hashRaw(readFileSync(file)) !== state.plugin_hashes?.[name])
        throw new Failure(
          "PLUG-002",
          "Installed Plugin file has unowned changes.",
          "Preserve and inspect the changed Plugin before uninstall.",
          30,
        );
    }
    const connection = path.join(target, "connection.json");
    safePath(connection);
    if (existsSync(connection)) {
      const value = JSON.parse(readFileSync(connection, "utf8")) as Record<string, unknown>;
      const profile = readCoreProfile(config.stateDirectory);
      if (value.vaultPath !== profile.vault_path || value.vaultFingerprint !== profile.vault_fingerprint)
        throw new Failure(
          "VAULT-004",
          "Plugin connection ownership cannot be verified.",
          "Inspect connection metadata before uninstall.",
          20,
        );
    }
    for (const name of ["main.js", "manifest.json", "connection.json"]) {
      const file = path.join(target, name);
      safePath(file);
      if (existsSync(file)) unlinkSync(file);
    }
    // Vault and user Plugin data remain intact; shared development runtime is not removed.
    for (const name of [
      "core-profile.json",
      "bootstrap-index.json",
      "core-admin.secret",
      "paired-clients.json",
      "core-discovery.json",
      "core.log",
      "bootstrap-state.json",
    ]) {
      const file = path.join(config.stateDirectory, name);
      safePath(file);
      if (existsSync(file)) unlinkSync(file);
    }
    return {
      ok: true,
      status: "degraded",
      exitCode: 0,
      data: { vault_preserved: true, vault_path: state.vault_path },
      diagnostics: [],
    };
  } catch {
    return {
      ok: false,
      status: "failed",
      exitCode: 90,
      data: { vault_preserved: true },
      diagnostics: [
        issue(
          "SETUP-001",
          "Uninstall stopped before completing all component removals.",
          "Inspect installed components and retry explicit uninstall.",
        ),
      ],
    };
  }
}
