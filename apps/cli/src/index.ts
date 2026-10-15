#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { doctorShell, type ShellResult, setupShell, statusShell } from "@ideomy/bootstrap";
import { cliOutputSchema, protocolSchemas } from "@ideomy/contracts";
import { CoreClient, CoreClientError } from "@ideomy/core-client";
import { readCliAdminSecret, readCoreDiscovery, readCoreProfile } from "@ideomy/platform";

export const CLI_VERSION = "0.0.0";
const help = `Ideomy ${CLI_VERSION}

Usage: ideomy <command> [options]

Commands:
  setup       Begin guided setup
  status      Show a read-only component summary
  doctor      Run read-only diagnostic checks

Options:
  --help, -h            Show help
  --version, -V         Show version
  --json                Emit one versioned JSON document
  --vault <path>        Select a Vault path
  --new | --existing    Select setup mode
  --non-interactive     Never prompt
  --yes, -y             Accept ordinary safe confirmations
  --quiet, -q           Suppress normal human output
  --verbose, -v         Show diagnostic detail
  --no-color            Disable color output
`;

type Parsed = {
  command: string;
  json: boolean;
  quiet: boolean;
  mode?: "new" | "existing";
  vault?: string;
  nonInteractive: boolean;
  error?: string;
};

export function parseArgs(args: string[]): Parsed {
  const parsed: Parsed = {
    command: "help",
    json: args.includes("--json"),
    quiet: args.includes("--quiet") || args.includes("-q"),
    nonInteractive: args.includes("--non-interactive"),
  };
  const valueFlags = new Set(["--vault", "--channel", "--config"]);
  const booleanFlags = new Set([
    "--json",
    "--quiet",
    "-q",
    "--verbose",
    "-v",
    "--no-color",
    "--non-interactive",
    "--yes",
    "-y",
  ]);
  let commandSeen = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      parsed.command = "help";
      return parsed;
    }
    if (arg === "--version" || arg === "-V") {
      parsed.command = "version";
      return parsed;
    }
    if (arg === "--new" || arg === "--existing") {
      const next = arg.slice(2) as "new" | "existing";
      if (parsed.mode && parsed.mode !== next) parsed.error = "--new and --existing are mutually exclusive";
      parsed.mode = next;
      continue;
    }
    if (valueFlags.has(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("-")) {
        parsed.error = `${arg} requires a value`;
        break;
      }
      if (arg === "--vault") parsed.vault = value;
      if (arg === "--channel" && !["stable", "beta", "dev"].includes(value))
        parsed.error = "--channel must be stable, beta or dev";
      else if (arg !== "--vault") parsed.error = `${arg} is not available in the M0.1 shell`;
      continue;
    }
    if (arg === "--skip-open" || arg === "--skip-index") {
      parsed.error = `${arg} is not available in the M0.1 shell`;
      break;
    }
    if (booleanFlags.has(arg)) continue;
    if (arg.startsWith("-")) {
      parsed.error = `Unknown option: ${arg}`;
      break;
    }
    if (commandSeen) {
      parsed.error = `Unexpected argument: ${arg}`;
      break;
    }
    parsed.command = arg;
    commandSeen = true;
  }
  if (!parsed.error && !["help", "version", "setup", "status", "doctor"].includes(parsed.command))
    parsed.error = `Unknown command: ${parsed.command}`;
  if (!parsed.error && parsed.command !== "setup" && parsed.mode)
    parsed.error = "--new and --existing are setup options";
  if (!parsed.error && parsed.command !== "setup" && parsed.vault)
    parsed.error = "--vault scoping is not available for status/doctor in the M0.1 shell";
  return parsed;
}

const usageFailure = (message: string): ShellResult => ({
  ok: false,
  status: "failed",
  exitCode: 2,
  data: {},
  diagnostics: [
    { code: "CONFIG-002", severity: "error", message, remediation: "Run ideomy --help.", repairable: false },
  ],
});

function print(command: string, result: ShellResult, json: boolean, quiet: boolean): void {
  if (json) {
    process.stdout.write(
      `${JSON.stringify(cliOutputSchema.parse({ schema_version: "1", command, ok: result.ok, status: result.status, data: result.data, diagnostics: result.diagnostics, meta: { cli_version: CLI_VERSION } }))}\n`,
    );
  } else {
    if (!quiet) {
      process.stdout.write(`Ideomy ${command}: ${result.status}\n`);
      for (const [key, value] of Object.entries(result.data))
        process.stdout.write(`${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}\n`);
    }
    for (const issue of result.diagnostics)
      process.stderr.write(`${issue.code}: ${issue.message} ${issue.remediation}\n`);
  }
  process.exitCode = result.exitCode;
}

export async function run(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  if (options.error) {
    print(options.command, usageFailure(options.error), options.json, options.quiet);
    return;
  }
  if (options.command === "help" || options.command === "version") {
    if (options.json) {
      print(
        options.command,
        {
          ok: true,
          status: "healthy",
          exitCode: 0,
          data: options.command === "help" ? { help } : { version: CLI_VERSION },
          diagnostics: [],
        },
        true,
        options.quiet,
      );
      return;
    }
    process.stdout.write(options.command === "help" ? help : `${CLI_VERSION}\n`);
    return;
  }
  if (options.command === "setup") {
    if ((options.nonInteractive || !process.stdin.isTTY) && (!options.mode || !options.vault)) {
      print(
        "setup",
        usageFailure(
          !options.mode
            ? "Pass --new or --existing for non-interactive setup."
            : "Pass --vault <path> for non-interactive setup.",
        ),
        options.json,
        options.quiet,
      );
      return;
    }
    print(
      "setup",
      setupShell({
        ...(options.mode ? { mode: options.mode } : {}),
        ...(options.vault ? { vault: options.vault } : {}),
        nonInteractive: options.nonInteractive || !process.stdin.isTTY,
      }),
      options.json,
      options.quiet,
    );
    return;
  }
  if (options.command === "status") {
    let discoveryFound = false;
    try {
      const discovery = protocolSchemas.discovery.parse(readCoreDiscovery());
      discoveryFound = true;
      const profile = readCoreProfile();
      if (profile.vault_id !== discovery.vault_id)
        throw new CoreClientError("VAULT-004", "Core profile and discovery identify different Vaults.");
      const client = new CoreClient(readCoreDiscovery);
      const handshake = await client.connectCli(
        {
          vaultId: discovery.vault_id,
          vaultFingerprint: profile.vault_fingerprint,
          clientInstanceId: `cli_${process.pid}`,
          clientVersion: CLI_VERSION,
        },
        readCliAdminSecret(),
      );
      const health = await client.systemHealth();
      const baseline = statusShell();
      print(
        "status",
        {
          ok: true,
          status: health.status === "healthy" ? "healthy" : "degraded",
          exitCode: 0,
          data: {
            ...baseline.data,
            core: { status: "running", version: handshake.core_version },
            vault: health.vault,
            schema: health.schema,
            index: health.index,
          },
          diagnostics: [],
        },
        options.json,
        options.quiet,
      );
    } catch (error) {
      if (!discoveryFound && (error as NodeJS.ErrnoException).code === "ENOENT") {
        print("status", statusShell(), options.json, options.quiet);
        return;
      }
      const code = error instanceof CoreClientError ? error.code : "CORE-503";
      const baseline = statusShell();
      print(
        "status",
        {
          ...baseline,
          ok: false,
          exitCode: code.startsWith("VAULT-") ? 20 : 40,
          diagnostics: [
            {
              code,
              severity: "error",
              message: "Ideomy Core authentication or handshake failed.",
              remediation: "Check Core state and Vault identity with ideomy doctor.",
              repairable: false,
            },
          ],
        },
        options.json,
        options.quiet,
      );
    }
    return;
  }
  print("doctor", doctorShell(), options.json, options.quiet);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void run();
