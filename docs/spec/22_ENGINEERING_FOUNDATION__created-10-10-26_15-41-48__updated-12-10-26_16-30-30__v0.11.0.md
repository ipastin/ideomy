---
title: "Engineering Foundation & Repository Contract"
created: "10-10-26 15-41-48"
updated: "12-10-26 16-30-30"
version: "0.11.0"
status: "accepted"
commit: "refactor(brand): adopt Ideomy canonical namespace"
---

# Engineering Foundation & Repository Contract

Created: 10-10-26 15-41-48  
Updated: 12-10-26 16-30-30  
Version: 0.11.0  
Change: `refactor(brand): adopt Ideomy canonical namespace`

## 1. Purpose

This document freezes the initial repository/toolchain/platform decisions required before Codex writes foundational code.

The goal is not “perfect forever”; it is to remove avoidable implementation ambiguity from M0/M1.

## Canonical namespace

Current pre-code namespace is frozen as:

```text
Product: Ideomy
Repository: ideomy
CLI executable: ideomy
Package scope: @ideomy/*
Local config/runtime namespace: ideomy / .ideomy where applicable
Plugin/tool/MCP namespace: ideomy
Protocol headers: X-Ideomy-*
```

Do not implement compatibility aliases for `Ideome` / `ideome`; the rename happened before a public implementation existed.


## 2. Repository name

Canonical repo:

```text
ideomy
```

`ideomy-core` as repository name is superseded. `Core` is one application/runtime inside the monorepo.

## 3. Monorepo layout

```text
ideomy/
├── apps/
│   ├── core/
│   ├── cli/
│   └── obsidian-plugin/
│
├── packages/
│   ├── contracts/
│   ├── config/
│   ├── vault-io/
│   ├── schema/
│   ├── index/
│   ├── graph/
│   ├── retrieval/
│   ├── transactions/
│   ├── bootstrap/
│   ├── core-client/
│   ├── model-gateway/
│   └── platform/
│
├── fixtures/
│   └── test-vault/
├── vault-template/
├── schemas/
├── contracts/
├── evals/
├── docs/
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
└── pnpm-lock.yaml
```

Specification Pack artifacts are copied/adopted into these locations during repo bootstrap rather than recreated from prose.

## 4. Dependency graph

Allowed high-level direction:

```text
apps/obsidian-plugin → core-client, contracts, config(UI-safe)
apps/cli            → bootstrap, core-client, platform, contracts
apps/core           → vault-io, schema, index, graph, retrieval, transactions, model-gateway, platform, contracts

retrieval → index/graph/contracts
transactions → vault-io/schema/contracts
bootstrap → platform/core-client/contracts
model-gateway → contracts/config/platform credential abstraction
```

Forbidden:

```text
contracts → app/platform/provider SDK
core domain package → Obsidian API
Plugin → Core server implementation
skill → cloud provider SDK
schema → filesystem UI
```

CI includes an import-boundary test/lint rule.

## 5. Runtime baseline — verified 10-10-26

For M0/M1:

```text
Node.js 24 LTS (Krypton)
pnpm 12.x
TypeScript 7.x strict
Vitest 5.x
Zod 4.6.x
Biome 2.5.x
```

Rationale:

- Node 24 is the chosen LTS baseline; Node 26 is still Current on 10-10-26, so M0 does not adopt it before LTS stabilization;
- pnpm 12 / TypeScript 7 / Vitest 5 / Zod 4.6 are current stable major baselines as of this spec;
- TypeScript 7.0 intentionally does **not** expose the legacy programmatic compiler API. Ideomy M0 does not depend on that API. If a dev tool requires it, use the official `@typescript/typescript6` compatibility package rather than silently downgrading the project compiler.

Exact patches are pinned by lockfile/tooling configuration. Major upgrades require normal regression/ADR only when architecture/compatibility changes.

## 6. Package manager / task orchestration

Use pnpm workspaces. Do **not** add Turborepo/Nx in M0 unless build scale demonstrates a need.

Canonical root commands:

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:contract
pnpm build
pnpm validate:schemas
pnpm validate:fixtures
```

## 7. TypeScript configuration

- strict mode;
- no implicit any;
- exact optional/property semantics where practical;
- separate browser-safe and Node tsconfigs;
- project references/build boundaries or equivalent workspace checks;
- public package APIs explicit;
- no path aliases that hide forbidden dependency direction.

## 8. Formatting / lint

Biome is the default formatter/linter for M0. Add ESLint only if a specific rule cannot be expressed otherwise and the value outweighs duplicate tooling.

Architecture boundary rules may use a small custom script/test rather than a full additional lint framework.

## 9. Testing

Vitest is the primary unit/contract/integration runner.

Test layers:

```text
unit
contract
fixture/golden
Core integration
e2e bootstrap/plugin (later)
evals (semantic/model)
```

Tests are deterministic by default; provider calls are mocked/fake unless explicitly running a provider conformance suite.

## 10. Schemas

The Specification Pack JSON Schemas are the **bootstrap source of truth** for persistent entity/protocol contracts. During repository bootstrap, Codex MUST translate/adopt them into canonical typed runtime definitions under `packages/schema` / `packages/contracts` using Zod, then generate/check JSON Schema from those runtime definitions.

After that one-time adoption:

```text
Zod runtime definitions
→ generated JSON Schema
→ parity/fixture validation
```

becomes the canonical implementation direction. Hand-maintaining two independent schema definitions is forbidden. Generated JSON Schema MUST remain semantically compatible with the v0.9 seed artifacts; intentional breaking changes require schema version/migration + ADR.

## 11. YAML / Markdown libraries

Baseline:

```text
YAML: `yaml` Document/node API for comment/order-aware parsing
Markdown read/index AST: unified/remark-compatible parser
Writes: surgical frontmatter/AUTO-section operations; never full Markdown AST serialization by default
Watcher: chokidar or equivalent behind FileWatcher interface
```

Exact library versions are lockfile concerns; behavior must satisfy `20_VAULT_IO_AND_SCHEMA` golden tests.

## 12. SQLite

Use an `SqliteStore` interface.

Alpha baseline: `better-sqlite3` 13.x, which uses N-API and supports modern Node 24 prebuilds, behind the adapter boundary.

Do not depend directly on Node's `node:sqlite` for canonical persistence in M0 because the current Node 24 LTS documentation still marks it pre-stable (Stability 1.2 — Release candidate). The `SqliteStore` boundary keeps a later migration possible.

No ORM is required initially. Use explicit migrations/SQL and typed repository functions; reconsider ORM only if schema complexity provides clear benefit.

## 13. SQLite migrations

Derived DB has its own migration version independent of Vault `ideomy_schema`.

Rules:

- migrations committed as ordered SQL/TS steps;
- migrations idempotency/precondition tested;
- because index is derived, destructive DB reset/rebuild remains an escape hatch when migration is unsafe;
- transaction recovery metadata needed to protect canonical writes is handled according to transaction contract and cannot be discarded mid-recovery without explicit repair.

## 14. Core server

M0 Core is a Node process with a narrow loopback HTTP server implementing `21_CORE_PROTOCOL`.

HTTP framework choice must remain small; use Node built-in HTTP or a lightweight server layer. Do not introduce a broad web framework solely for localhost API.

SSE implements event/stream channel in V1.

## 15. CLI

TypeScript Node application. Parser/prompts are UI libraries only; command business logic lives in packages.

CLI framework may be `commander`, `clipanion` or similarly lightweight, but **command tree/flags/output are fixed by `18_CLI`**. Selection of one library at bootstrap is implementation-level and then pinned.

## 16. Obsidian Plugin build

Follow Obsidian plugin packaging conventions with a browser/Electron-compatible bundle. Use an esbuild-based build compatible with official/community plugin expectations.

Plugin source does not import Node/Electron APIs because V1 targets `isDesktopOnly: false`.

`manifest.json`, `versions.json`, `main.js`, `styles.css` are release artifacts as applicable.

## 17. Initial supported platform

### M0/Alpha Core lifecycle

```text
macOS 13.5+ (aligned with Node 24 binary baseline)
Apple Silicon (arm64) supported
Intel (x64) supported
At least one arm64 and one x64 bootstrap smoke path MUST be exercised before Alpha is called broadly macOS-compatible; local development may use either architecture.
```

A platform adapter interface is mandatory from day one.

### Later

```text
Windows x64/arm64
Linux x64/arm64
```

are added through separate lifecycle/install adapters before claiming public support.

Plugin/mobile support is governed separately and is not blocked by Core Alpha platform scope.

## 18. macOS platform adapter

M0 responsibilities:

```text
config/cache/state paths
Core process start/stop/status
launch-on-login/autostart decision
file permissions
credential-store integration
Obsidian discovery/CLI invocation
```

For Alpha, foreground/user-process lifecycle is acceptable where explicitly documented. Before Public Beta, background lifecycle/autostart must be formalized and signed/notarized as appropriate.

## 19. Core distribution

### Development

Run built Node application from workspace.

### Alpha

Node 24 may be an explicit development/test prerequisite. Bootstrap still owns Core installation/config, but public no-toolchain promise is not yet claimed.

### Public Beta / V1

User must not manually install Node/build tools. Produce signed/integrity-verifiable Core/CLI artifacts. Node SEA is a candidate, but current upstream SEA is still active-development and is **not** frozen as the V1 packaging architecture in this spec.

A packaging ADR is required before Public Beta.

## 20. Secrets

Provide `CredentialStore` abstraction.

Priority:

```text
OS keychain/credential store
→ explicit env-var reference for dev/automation
```

Never write provider secrets into Vault, ordinary config JSON, logs, diffs or fixtures.

## 21. Configuration directories

Platform package exposes:

```text
configDir
stateDir
cacheDir
logDir
runtimeDir
```

No package constructs OS-specific paths directly outside `platform`.

## 22. CI — M0

Primary CI runs on macOS and Linux where feasible for pure packages; macOS job is required for platform/bootstrap acceptance.

Every PR:

```text
pnpm install --frozen-lockfile
format/lint
typecheck
unit/contract tests
schema self-validation
fixture validation
protocol example validation
architecture import-boundary check
secret scan
```

No job mounts or accesses a production Personal Vault.

## 23. Versioning

```text
Ideomy product/repo packages: SemVer
Core protocol: integer major + capability negotiation
Vault managed schema: integer `ideomy_schema`
Derived SQLite DB: independent migration version
Specification Pack: SemVer pre-1.0
```

Breaking public CLI/protocol/schema changes require migration/compatibility plan and ADR.

## 24. Dependency policy

Prefer standard library/small libraries over large frameworks. New dependency requires clear capability value and must not violate browser-vs-Node package boundaries.

No LangChain-style broad agent framework, Electron app shell, graph DB or cloud backend in M0/M1.

## 25. Repo scaffold Definition of Done

Before Codex implements real Vault/Core behavior:

- canonical repo named `ideomy`;
- workspace/package layout committed;
- Node/pnpm versions pinned/documented;
- CI commands green on empty/synthetic scaffold;
- architecture import-boundary check exists;
- schemas/protocol contracts copied from pack and validate;
- Vault template/test fixture copied from pack;
- root `AGENTS.md` installed;
- Personal Vault is not inside repo.

## 28. Web Clipper integration artifacts

Repository placement:

```text
web-clipper/
  README.md
  templates/*.json

contracts/capture/
  web-capture-v1.schema.json
  web-capture-v1.example.json
```

These are distribution/spec artifacts, not an additional browser-extension codebase. No Chrome/Firefox extension workspace is created in V1.
