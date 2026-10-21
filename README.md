# Ideomy — a local-first personal knowledge system

Ideomy is an in-development system for connecting notes, sources, projects, and decisions in an Obsidian Vault. **Your Vault's Markdown files and attachments are the source of truth**; the SQLite search index can be rebuilt from them.

> **Status:** Early development. This repository provides a source-based CLI, a development Obsidian Plugin, and local Core packages. It is not a packaged end-user release.

## What works today

- **Foundation:** the `ideomy` CLI can set up or attach a Vault and report status and diagnostics. The macOS bootstrap path is the current development target.
- **Obsidian connection:** the development Plugin connects to the local Core and exposes connection diagnostics.
- **Finding context:** a rebuildable SQLite/FTS index and package-level graph traversal, scoped retrieval, and Project Context Packs are implemented and tested with synthetic Vault data.

Typed Vault transactions, Model Gateway, AI skills, and external MCP access are later milestones. The current CLI does not expose the package-level retrieval functions as a user-facing search command. See the [implementation roadmap](docs/spec/11_IMPLEMENTATION__created-06-10-26_16-40-00__updated-15-10-26_14-53-19__v0.11.1.md) for the intended sequence.

## What makes Ideomy different

Ideomy combines Vault ownership, explicit knowledge structure, and bounded automation. [What works today](#what-works-today) separates implemented pieces from the planned behavior below.

- **Keep the Vault authoritative.** Markdown and attachments hold the knowledge; the SQLite/FTS index can be rebuilt without losing it.
- **Use existing notes without forced migration.** Unmanaged notes can be indexed and linked without being silently adopted or rewritten. Managed entities use stable IDs independent of filenames.
- **Keep evidence and insight distinct.** The planned capture pipeline separates Inbox clips, Sources, synthesized Knowledge, and Decisions. A clip may enrich an existing Source or produce no new Knowledge.
- **Limit the context AI can use.** Package-level Project Context Packs already scope retrieval. The planned Model Gateway must exclude `denied` content and never send `local_only` content to a cloud provider through fallback.

## Try the development CLI

Prerequisites: **Node.js 24** and **pnpm 12.13.0** (via Corepack). The full Core/bootstrap path currently targets macOS; CI also checks the repository on Ubuntu.

```sh
git clone https://github.com/ipastin/ideomy.git
cd ideomy
corepack enable
corepack install -g pnpm@12.13.0
pnpm install --frozen-lockfile
pnpm exec ideomy status --json
```

The last command prints a versioned JSON status document. Seeing `"status":"degraded"` before setup is expected: no Vault, Plugin, or Core has been configured yet. Run `pnpm exec ideomy --help` to see the available development commands. For an actual Vault setup, use an **absolute Vault path outside this repository** and review the CLI's plan before confirming it; the [bootstrap specification](docs/spec/16_BOOTSTRAP__created-09-10-26_16-54-26__updated-15-10-26_14-53-19__v0.11.1.md) describes the prerequisites and recovery states.

## How it is organized

```text
Obsidian Plugin ─┐
                ├─ versioned CoreClient → local Core → external Personal Vault
CLI ─────────────┘                            │
                                              └─ rebuildable SQLite/FTS index
```

The Personal Vault stays outside the software repository and is never required for builds or CI. Tests and examples use synthetic fixtures. Browser capture follows the official Obsidian Web Clipper templates in [`web-clipper/`](web-clipper/); captured page content remains untrusted input, while Core handles semantic processing.

## Develop and contribute

Start with [`AGENTS.md`](AGENTS.md) and the [Specification Pack](docs/spec/00_README__created-06-10-26_16-40-00__updated-20-10-26_17-55-18__v0.11.3.md). The accepted [ADR index](docs/spec/13_ADR__created-06-10-26_16-40-00__updated-20-10-26_17-55-18__v0.11.3.md) and machine-readable schemas/contracts define the boundaries; implementation changes should preserve them. Open an issue for a proposed change and keep fixtures synthetic.

The repository's CI runs formatting, lint, type checks, tests, build, and artifact validation on macOS and Ubuntu. Run the relevant checks from the repository root before a pull request:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

Copyright 2026 Igor Pastin. All files in this repository are licensed under the [Mozilla Public License 2.0](LICENSE) (`MPL-2.0`). If you distribute modified Ideomy files, you must make the covered source files available to recipients under MPL-2.0. Running a modified version only as a hosted service does not, by itself, trigger that distribution requirement.

The external Personal Vault is outside this repository and is not covered by its license. Installed third-party dependencies retain their own licenses.

<!--
created: 21-10-26 09-18-58
updated: 21-10-26 13-16-55
version: 0.1.4
commit: docs(readme): explain Ideomy design choices
-->
