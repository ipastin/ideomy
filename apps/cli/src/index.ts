#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import {
  doctorFoundation,
  repairFoundation,
  type ShellResult,
  setupFoundation,
  statusFoundation,
  uninstallFoundation,
  updateFoundation,
} from "@ideomy/bootstrap";
import { cliOutputSchema } from "@ideomy/contracts";

export const CLI_VERSION = "0.0.0";
const help = `Ideomy ${CLI_VERSION}

Usage: ideomy <command> [options]

Commands:
  setup       Create or attach a Vault and install the local development Foundation
  status      Show a read-only component summary
  doctor      Run read-only diagnostic checks
  repair      Preview and apply narrow diagnosed repairs
  update      Check development artifact compatibility
  uninstall   Remove Ideomy components while preserving the Vault

Options:
  --help, -h            Show help
  --version, -V         Show version
  --json                Emit one versioned JSON document
  --vault <path>        Select a Vault path
  --new | --existing    Select setup mode
  --non-interactive     Never prompt
  --yes, -y             Accept ordinary safe confirmations
  --skip-open           Do not open the Vault after setup
  --skip-index          Leave index incomplete for support/testing
  --check               Inspect available update only
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
  yes: boolean;
  skipOpen: boolean;
  skipIndex: boolean;
  check: boolean;
  channel?: "stable" | "beta" | "dev";
  error?: string;
};

export async function promptForSetup(
  options: Pick<Parsed, "mode" | "vault">,
  question: (message: string) => Promise<string>,
): Promise<Pick<Parsed, "mode" | "vault">> {
  const mode = options.mode ?? (await question("Create a new Vault or attach an existing one? [new/existing] ")).trim();
  if (mode !== "new" && mode !== "existing") throw new Error("Choose new or existing.");
  const vault = options.vault ?? (await question("Absolute Vault path: ")).trim();
  if (!vault) throw new Error("Enter an absolute Vault path.");
  return { mode, vault };
}

export function parseArgs(args: string[]): Parsed {
  const parsed: Parsed = {
    command: "help",
    json: args.includes("--json"),
    quiet: args.includes("--quiet") || args.includes("-q"),
    nonInteractive: args.includes("--non-interactive"),
    yes: args.includes("--yes") || args.includes("-y"),
    skipOpen: args.includes("--skip-open"),
    skipIndex: args.includes("--skip-index"),
    check: args.includes("--check"),
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
    "--skip-open",
    "--skip-index",
    "--check",
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
      else if (arg === "--channel") parsed.channel = value as "stable" | "beta" | "dev";
      else if (arg !== "--vault") parsed.error = `${arg} is not available in this build`;
      continue;
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
  if (
    !parsed.error &&
    !["help", "version", "setup", "status", "doctor", "repair", "update", "uninstall"].includes(parsed.command)
  )
    parsed.error = `Unknown command: ${parsed.command}`;
  if (!parsed.error && parsed.command !== "setup" && parsed.mode)
    parsed.error = "--new and --existing are setup options";
  if (!parsed.error && parsed.command !== "setup" && (parsed.skipOpen || parsed.skipIndex))
    parsed.error = "--skip-open and --skip-index are setup options";
  if (!parsed.error && parsed.command !== "update" && parsed.check) parsed.error = "--check is an update option";
  if (!parsed.error && !["setup", "update"].includes(parsed.command) && parsed.channel)
    parsed.error = "--channel is a setup/update option";
  if (!parsed.error && !["setup", "doctor"].includes(parsed.command) && parsed.vault)
    parsed.error = "--vault is not available for this command";
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

export function setupPromptFailure(error: unknown): ShellResult | 130 {
  if (error instanceof Error && error.name === "AbortError") return 130;
  return usageFailure(error instanceof Error ? error.message : "Setup input was cancelled.");
}

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
    const interactive = !options.nonInteractive && !options.json && process.stdin.isTTY && process.stdout.isTTY;
    if (!interactive && (!options.mode || !options.vault)) {
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
    if (interactive) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        if (!options.mode || !options.vault)
          Object.assign(options, await promptForSetup(options, (message) => prompt.question(message)));
        if (!options.yes) {
          const preview = await setupFoundation({
            ...(options.mode ? { mode: options.mode } : {}),
            ...(options.vault ? { vault: options.vault } : {}),
            nonInteractive: false,
            channel: options.channel ?? "dev",
          });
          if (preview.data.plan) process.stdout.write(`${JSON.stringify(preview.data.plan, null, 2)}\n`);
          else {
            print("setup", preview, false, options.quiet);
            return;
          }
          options.yes = /^(?:y|yes)$/i.test((await prompt.question("Apply this plan? [y/N] ")).trim());
          if (!options.yes) {
            print("setup", usageFailure("Setup was not confirmed."), false, options.quiet);
            return;
          }
        }
      } catch (error) {
        const failure = setupPromptFailure(error);
        if (failure === 130) {
          process.exitCode = 130;
          return;
        }
        print("setup", failure, false, options.quiet);
        return;
      } finally {
        prompt.close();
      }
    }
    print(
      "setup",
      await setupFoundation({
        ...(options.mode ? { mode: options.mode } : {}),
        ...(options.vault ? { vault: options.vault } : {}),
        ...(options.channel ? { channel: options.channel } : {}),
        nonInteractive: !interactive,
        yes: options.yes,
        skipOpen: options.skipOpen,
        skipIndex: options.skipIndex,
        json: options.json,
      }),
      options.json,
      options.quiet,
    );
    return;
  }
  if (options.command === "status") {
    print("status", await statusFoundation(), options.json, options.quiet);
    return;
  }
  if (options.command === "doctor") {
    print("doctor", await doctorFoundation(options.vault ? { vault: options.vault } : {}), options.json, options.quiet);
    return;
  }
  if (options.command === "repair") {
    print(
      "repair",
      await repairFoundation({
        yes: options.yes,
        onPlan: (plan) => process.stderr.write(`Repair plan: ${JSON.stringify(plan)}\n`),
      }),
      options.json,
      options.quiet,
    );
    return;
  }
  if (options.command === "uninstall") {
    if (!options.yes) {
      print(
        "uninstall",
        usageFailure("Review the uninstall plan and pass --yes; the Vault is preserved."),
        options.json,
        options.quiet,
      );
      return;
    }
    print("uninstall", await uninstallFoundation(), options.json, options.quiet);
    return;
  }
  if (options.command === "update") {
    print(
      "update",
      await updateFoundation({ channel: options.channel ?? "dev", check: options.check }),
      options.json,
      options.quiet,
    );
    return;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void run();
