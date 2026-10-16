---
title: "Implementation Blueprint & Roadmap"
created: "06-10-26 16-40-00"
updated: "15-10-26 14-53-19"
version: "0.11.1"
status: "accepted"
commit: "docs(bootstrap): separate Plugin P0 acceptance"
---

# Implementation Blueprint & Roadmap

Created: 06-10-26 16-40-00  
Updated: 15-10-26 14-53-19  
Version: 0.11.1  
Change: `docs(bootstrap): separate Plugin P0 acceptance`

## 1. Purpose

This is the **single current engineering roadmap**. Historical phase orders have been removed from this document; superseded decisions remain only in ADR/Changelog.

## 2. Repository

Canonical software repository:

```text
ideomy/
```

Monorepo structure is fixed in `22_ENGINEERING_FOUNDATION`.

Production Personal Vault is external. `fixtures/test-vault` is synthetic and committed.

## 3. Engineering baseline

Canonical toolchain/platform baseline lives in `22_ENGINEERING_FOUNDATION`.

At v0.9:

```text
Runtime/Core/CLI: Node.js 24 LTS
Package manager:  pnpm 12.x (lockfile pinned)
Language:         TypeScript 7.x strict
Schemas:          Zod 4.6.x + generated/checked JSON Schema
Tests:            Vitest 5.x
Lint/format:      Biome 2.5.x
Core DB:          SQLite via adapter (Alpha: better-sqlite3 13.x)
Plugin build:     esbuild-based Obsidian bundle
```

Exact dependency patches are committed in lockfile; architecture depends on contracts, not minor-version-specific APIs.

## 4. M0 — Repository / specification foundation

Build:

```text
repo + pnpm workspace
AGENTS/spec pack
CI
package boundaries/dependency checks
schemas/
vault-template/
fixtures/test-vault/
contracts/protocol/v1/
```

Exit:

- `pnpm install --frozen-lockfile` succeeds on supported dev baseline;
- typecheck/test/lint commands exist;
- no production Vault access in CI;
- schema/protocol artifacts validate.

## 5. M0.1 — CLI-0 / Bootstrap shell

Implement public skeleton from `18_CLI` and state machine from `16_BOOTSTRAP`:

```text
ideomy --help
ideomy --version
ideomy setup
ideomy status
ideomy doctor
```

No AI dependency.

## 6. M0.2 — Vault I/O / schema

Implement `20_VAULT_IO_AND_SCHEMA`:

```text
Vault root identity
Markdown/frontmatter parser
managed/unmanaged note classification
ULID generation
property mapping
schema validation
link extraction
round-trip preservation
file watcher + own-write suppression
```

Exit:

- golden fixtures parse;
- invalid managed notes produce stable diagnostics;
- unmanaged notes remain readable and untouched;
- round-trip tests prove unrelated content preservation.

## 7. M0.3 — Core service / protocol

Implement `21_CORE_PROTOCOL`:

```text
Core process
machine-local discovery
/v1 health + handshake
pairing/session auth
Vault identity binding
CoreClient
operation/error envelopes
```

Exit:

- CLI and mock Plugin authenticate to Core;
- wrong Vault fingerprint rejected;
- restart/reconnect works;
- no unauthenticated sensitive endpoint.

## 8. M0.4 — Bootstrap Plugin P0

Implement P0 scope from `19_OBSIDIAN_PLUGIN`:

```text
manifest/lifecycle
minimal Ideomy View
CoreClient handshake/status
Core missing/stopped/incompatible states
Vault identity state
```

Exit:

```text
supported Alpha/development path installs/enables Plugin
→ real Obsidian Plugin pairs/authenticates with Core
→ compatible handshake/status and active Vault identity verified
→ Plugin P0 acceptance in 19_OBSIDIAN_PLUGIN passes
```

Verify the installed Plugin and Core with a real macOS Obsidian smoke test. Missing schema/index capability is reported truthfully; overall Bootstrap Foundation `doctor Healthy` is not an M0.4 acceptance claim. No LLM required.

## 9. M0.5 — Bootstrap Foundation completion and hardening

Add:

```text
minimal deterministic Vault parse/schema/index and health checks from 16_BOOTSTRAP
idempotent setup/resume
existing-Vault non-destructive flow
repair/update/uninstall foundations
macOS Core lifecycle adapter
interruption tests
support diagnostics
```

M0 and Bootstrap Foundation are complete only when the full `16_BOOTSTRAP` Definition of Done passes, including `ideomy doctor Healthy` with a current initial deterministic index, and clean-machine and interrupted-install acceptance tests pass.

## 10. M1 — Structured index / FTS

Expand the minimal Bootstrap index into the structured SQLite/FTS index. Implement schema/migrations per `22_ENGINEERING_FOUNDATION` and Vault contracts:

```text
entities
relationships
file_state
transactions
FTS documents/chunks
index metadata
```

Requirements:

- index disposable/rebuildable;
- file rename preserves entity identity;
- duplicate IDs hard error;
- delete/rename watcher behavior deterministic;
- Russian/English full-text golden tests.

## 11. M1.1 — Graph + retrieval

Implement:

```text
structured filtering
exact ID/title/alias lookup
FTS
relationship traversal
canonical authority ranking
Context Packs
```

No vector store until measured retrieval gaps justify ADR.

## 12. M1.2 — Typed mutations / transactions

Implement:

```text
optimistic hash/version checks
single/multi-file mutation plan
transaction states
snapshots
atomic per-file replacement
post-write validation
diff
commit/rollback/recovery
```

Transaction semantics are governed by `20_VAULT_IO_AND_SCHEMA`.

## 13. M2 — Model Gateway

Implement in order:

```text
contracts + fake deterministic provider
→ OpenAI-compatible/local adapter
→ first-party OpenAI/Anthropic/Gemini adapters
→ privacy/cost/capability routing
```

No provider call bypasses Model Gateway.

## 14. M2.1 — first LLM vertical slices

Order:

```text
classify
→ connect
→ ask
→ source-process / knowledge-synthesize
```

Each skill gets typed contracts + golden evals before promotion.

## 15. M3 — MCP / external AI hosts

Read-first:

```text
search
get_entity
get_context
system_health
```

Then review-bound writes. External subscription-host use remains distinct from Model Gateway direct API providers.

## 16. M3.1 — Product Plugin expansion

Progressively implement P1–P4 from `19_OBSIDIAN_PLUGIN`:

```text
Capture/System Health
→ Ask/Process Context
→ Review Queue/Diff/Inspector
→ Reviews/mobile/theme/accessibility polish
```

## 17. Eval/release harness

`12_EVALS` defines required suites/thresholds. Every semantic/model/schema/protocol change updates relevant golden cases.

## 18. Alpha platform scope

M0/M1 Core lifecycle/bootstrap supports **macOS first**. Cross-platform packages and interfaces must not import macOS-specific implementation directly.

Windows/Linux Core lifecycle adapters are separate milestones before public V1 claim of desktop support.

Plugin remains cross-platform/mobile-light according to its own contract.

## 19. Distribution evolution

### Development

Node runtime / workspace execution is acceptable.

### Alpha

CLI/Core distribution may require the supported Node 24 runtime while install/update contracts are proven.

### Public Beta/V1

Core/CLI should be distributed without requiring users to manually install a development toolchain. Exact standalone packaging/signing mechanism is selected and ADR'd before Public Beta; Node SEA is an option but is not treated as stable architecture because upstream SEA remains active-development.

## 20. CI gates

Every PR:

```text
install frozen
lint/format check
typecheck
unit tests
schema validation
protocol-schema validation
fixture validation
architecture/dependency boundaries
secret scan
```

Milestone-specific contract/e2e/eval suites are added as the milestone lands.

## 21. Definition of implementation readiness

The repository may implement real M0/M1 code only against:

- normalized docs with no current legacy competing instruction;
- machine-readable schemas;
- committed synthetic fixtures/template;
- fixed repo/toolchain boundaries;
- versioned Core protocol;
- accepted ADRs 120+.

## 22. Web Capture V1

Web Capture is an integration slice, not a separate browser-extension application.

Implementation order:

```text
ship/import Web Clipper template pack
→ recognize `web-v1` capture envelope
→ watcher ingests `01 Inbox/Web`
→ canonical URL/provenance normalization
→ dedup/source resolution
→ processing/classification later on existing M1/M2 paths
```

M0 health does not require Web Clipper installation. Web Capture V1 can be enabled after Vault bootstrap without changing Core architecture.

Do not begin a custom browser extension unless a new ADR demonstrates product value beyond clipping parity.
