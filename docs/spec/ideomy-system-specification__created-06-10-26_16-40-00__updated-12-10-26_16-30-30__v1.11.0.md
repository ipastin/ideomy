---
title: "Ideomy System Specification"
created: "06-10-26 16-40-00"
updated: "12-10-26 16-30-30"
version: "1.11.0"
status: "accepted"
commit: "refactor(brand): adopt Ideomy canonical namespace"
---

# Ideomy System Specification v1.11.0

Created: 06-10-26 16-40-00  
Updated: 12-10-26 16-30-30  
Version: 1.11.0  
Change: `refactor(brand): adopt Ideomy canonical namespace`

## Generation note

This consolidated specification is generated from current numbered Specification Pack documents. Machine-readable schemas/contracts/templates/fixtures/evals ship alongside the Pack and are normative where referenced. Historical superseded decisions remain only in ADR/Changelog.

## v1.11.0 — 12-10-26

- `refactor(brand): adopt Ideomy canonical namespace`
- Canonical masterbrand changed from **Ideome** to **Ideomy** before implementation begins.
- Technical namespace changed from `ideome` to `ideomy` across repository, CLI, package scope, Plugin/Core/MCP/tool/config/runtime/schema identifiers, protocol headers and Web Clipper artifacts.
- No backward-compatibility alias is required because no public implementation has shipped.
- Architecture, ontology, Web Capture and Implementation Readiness semantics are otherwise unchanged.

---

---

<!-- SOURCE: 00_README__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ideomy — Project Specification Pack


## 1. Purpose

This pack is the canonical source of truth for implementing **Ideomy — Personal Knowledge OS**. It is optimized for human review and AI coding agents such as Codex.

**Canonical naming invariant:** `Ideomy` is the only current product name and `ideomy` is the only current technical namespace. The former name `Ideome` may appear only in rename history/ADR-141.

The pack intentionally separates:

```text
product intent
→ architecture
→ ontology/data contracts
→ deterministic Core
→ delivery/bootstrap/CLI/Plugin
→ Model Gateway/Agent
→ executable schemas/fixtures/protocol contracts
```

## 2. Implementation-readiness status

`v0.11.0` performs the final pre-code **canonical brand and namespace rename from Ideome to Ideomy**. All current product, repository, CLI, Plugin, Core/MCP, configuration, schema and Web Capture namespaces now use `Ideomy` / `ideomy`. The v0.10.0 Web Capture V1 and v0.9.0 Implementation Readiness contracts remain otherwise unchanged.

The release is intended to allow Codex to start M0/M1 implementation without inventing:

- repository/package boundaries;
- entity IDs and schema rules;
- Markdown/frontmatter mutation semantics;
- Core local protocol/authentication;
- initial toolchain/platform baseline;
- Vault template and synthetic fixtures.

## 3. Canonical documents

| ID | Document | Purpose |
|---|---|---|
| 00 | README | pack map, precedence, implementation readiness |
| 01 | PRODUCT | vision, JTBD, scope and product boundaries |
| 02 | ARCHITECTURE | target system topology and trust boundaries |
| 03 | ONTOLOGY_DATA_MODEL | 7 Domains / 17 Areas / 15 Entity Types and logical data model |
| 04 | KNOWLEDGE_INTELLIGENCE | capture, synthesis, retrieval and knowledge-quality semantics |
| 05 | AGENT_RUNTIME | orchestrator, tools, permissions and bounded execution |
| 06 | SKILLS | skill registry/contracts and phased skill scope |
| 07 | CONTEXT_MEMORY | Context Packs, canonical vs transient memory and invalidation |
| 08 | SAFETY | privacy, permissions, untrusted content and mutation policy |
| 09 | CONNECTORS | source/integration boundaries and external app ownership |
| 10 | UX | product IA, reviews, dashboards and interaction principles |
| 11 | IMPLEMENTATION | **single canonical engineering roadmap** |
| 12 | EVALS | executable quality gates and golden-suite policy |
| 13 | ADR | accepted/superseded architecture decisions |
| 14 | AGENTS | executable coding-agent instructions |
| 15 | DELIVERY | product packaging/distribution/onboarding |
| 16 | BOOTSTRAP | setup/status/doctor state machine and installable M0 slice |
| 17 | MODEL_GATEWAY | cloud/local/external-host LLM architecture |
| 18 | CLI | public CLI contract |
| 19 | OBSIDIAN_PLUGIN | Plugin product/technical contract |
| 20 | VAULT_IO_AND_SCHEMA | **file identity, frontmatter, IDs, safe round-trip and schema/migrations** |
| 21 | CORE_PROTOCOL | **Core discovery, pairing/auth, versioned local API and event protocol** |
| 22 | ENGINEERING_FOUNDATION | **monorepo/toolchain/platform/build/package decisions** |

## 4. Machine-readable artifacts

The pack additionally contains:

```text
schemas/
  base.schema.json
  registry.json
  relationships.json
  entities/*.schema.json

contracts/
  protocol/v1/*.schema.json
  examples/*.json

vault-template/
  canonical new-Vault scaffold

fixtures/test-vault/
  synthetic managed/unmanaged notes and adversarial cases

evals/
  thresholds.json
  golden/*.jsonl

web-clipper/
  README.md
  templates/*.json

contracts/capture/
  web-capture-v1.schema.json
  web-capture-v1.example.json
```

These artifacts are normative where explicitly referenced by the documents. Prose and machine-readable contracts must be changed together.

## 5. Required reading order for Codex

Before any substantial implementation task:

```text
00 README
→ 14 AGENTS
→ 13 ADR
→ 22 ENGINEERING_FOUNDATION
→ relevant domain document
→ 20 VAULT_IO_AND_SCHEMA for any Vault/schema/parser/write work
→ 21 CORE_PROTOCOL for Core/Plugin/CLI transport work
→ 11 IMPLEMENTATION
→ 12 EVALS
```

Additional required docs:

```text
Delivery/setup     → 15 + 16 + 18 + 19
Models/AI          → 17 + 05 + 06 + 07 + 08
Plugin             → 19 + 21
CLI                → 18 + 16 + 21
```

## 6. Priority of truth

When sources conflict:

```text
14 AGENTS hard invariant
> Accepted ADR not superseded
> machine-readable schema/protocol contract
> numbered domain specification
> implementation convenience / existing code
```

Historical superseded decisions belong in ADR/Changelog and must not remain as competing current instructions in domain documents.

## 7. Canonical architecture in one view

```text
                     User
                      │
          ┌───────────┴────────────┐
          ▼                        ▼
     Obsidian + Plugin            CLI
          │                        │
          └──────────┬─────────────┘
                     ▼
                 Ideomy Core
        ┌────────────┼──────────────┐
        ▼            ▼              ▼
   Vault I/O      Retrieval     Model Gateway
        │            │              │
        └───────┬────┘        cloud/local models
                ▼
        External Personal Vault
                │
                └── canonical Markdown/attachments

External AI hosts (ChatGPT/Claude/etc.)
        ↓ MCP
     Ideomy Core
```

## 8. Repository/data boundary

One mandatory software repository:

```text
ideomy/
```

The production Personal Vault is an external runtime data directory and is never:

- nested under the software repo;
- a Git submodule dependency;
- required by build/tests/CI;
- copied into fixtures/snapshots.

## 9. Supported implementation baseline

M0/Alpha is **macOS-first** for Core lifecycle/bootstrap while package boundaries remain cross-platform. Plugin remains mobile-installable/lightweight according to `19 OBSIDIAN_PLUGIN`.

Toolchain and exact support policy are canonical in `22 ENGINEERING_FOUNDATION`.

## 10. Current build order

```text
Spec normalization + machine contracts   ✓ v0.9.0
→ repo scaffold / CI
→ CLI-0 + Bootstrap state machine
→ Vault I/O + schema validator
→ Core service + protocol/handshake
→ Bootstrap Plugin P0
→ structured SQLite/FTS index
→ graph + Context Packs
→ typed mutation + transaction journal
→ Model Gateway
→ classify / connect / ask
→ read-first MCP
→ Review/remaining bounded skills
```

## 11. No-build-yet boundaries

Do not introduce before their milestone/ADR:

```text
vector database
Neo4j
generic shell/filesystem agent tool
multi-agent swarm
standalone Ideomy editor
cloud canonical knowledge DB
mandatory mobile Core
billing/account backend
unbounded background writes
```

## 12. Pack change policy

Architecture-significant changes require:

1. problem/context;
2. 2–3 options with trade-offs;
3. ADR decision;
4. affected machine contracts updated;
5. migration/backward compatibility;
6. eval/security impact;
7. `AGENTS.md` update when an invariant changes.

## 10. Web Capture V1

Browser capture in V1 uses the official **Obsidian Web Clipper**. The normative integration artifacts live under `web-clipper/` and `contracts/capture/`.

Canonical boundary:

```text
browser / Obsidian Web Clipper
→ lightweight Inbox capture
→ Ideomy Core normalization/dedup/classification
→ canonical Source/Knowledge only when justified
```

A custom Ideomy browser extension is explicitly **not required for V1**. It may be reconsidered only for browser-native Ideomy capabilities such as related-knowledge surfacing, Ask Ideomy, project routing and duplicate-aware capture before save.

---

<!-- SOURCE: 01_PRODUCT__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Product Vision & Scope



## 1. Product identity

**Ideomy** — local-first **Personal Knowledge OS**.

Former working/product name: **Ideome**. It is superseded by **Ideomy** and must not be used in current UI, code, packages or public documentation.

Public line:

> **Everything you know, connected.**

Internal brand idea:

> **Knowledge as a whole.**

## 2. Core user problem

Knowledge fragments across notes, sources, projects, chats, decisions, files and time. Search retrieves fragments; conventional AI summarizes fragments. The missing layer is durable, explicit context: what an item is, why it matters, what it relates to, what changed and what was decided.

Ideomy addresses this by making structure and relationships canonical while keeping AI replaceable.

## 3. Core JTBD

When I capture, learn, decide or work on something important, I want Ideomy to preserve and connect enough context that future me can retrieve, understand and continue the work without reconstructing everything manually.

Supporting jobs:

- capture with near-zero friction;
- distinguish Sources from synthesized Knowledge;
- maintain project and decision continuity;
- retrieve by meaning + structure + graph context;
- review what changed and what needs attention;
- keep ownership and portability of personal knowledge.

## 4. Product boundaries

Ideomy is not primarily:

- a generic chatbot;
- a universal task manager;
- a social network;
- a cloud-only memory API;
- a read-it-later archive;
- an autonomous assistant that silently rewrites personal history.

## 5. Product mental model

```text
Direction     → Domains / Areas / Goals
Execution     → Projects / Meetings / Decisions / Journal
Knowledge     → Sources / Knowledge / Records
Context       → People / Organizations / Places / Topics
Intelligence  → Retrieval / Context Packs / Agent skills / Reviews
```

## 6. MVP product surfaces

- Home;
- Capture / Inbox;
- Projects;
- Knowledge;
- Sources;
- Decisions;
- Weekly Review;
- Review Queue;
- Ask / semantic retrieval;
- System Health.

## 7. Product success criteria

MVP is useful when a real user can:

1. capture in seconds without classifying;
2. find a past decision reliably;
3. continue an active project from assembled context;
4. process a source without creating summary spam;
5. create/update Knowledge without duplicate proliferation;
6. complete a Weekly Review from an agent-prepared brief;
7. inspect and undo agent changes;
8. disable AI/Core and still retain a usable vault.

## 8. Canonical product specification excerpts

# 1. Executive summary

## 1.1. Итоговая архитектурная модель

```text
HUMAN
  ↓
OBSIDIAN
  ↓
CANONICAL MARKDOWN VAULT
  ↓
LOCAL IDEOMY CORE
  ↓
AI ORCHESTRATOR + SKILLS
  ↓
LOCAL / CLOUD MODELS
```

Система строится как **native-first hybrid architecture**:

- Obsidian — основной human interface;
- Markdown + YAML Properties — canonical storage;
- Bases — основной structured view/dashboard layer;
- wikilinks + typed properties — canonical relationships;
- Ideomy transaction layer — safe machine-write history, diff and rollback;
- Git — `ideomy` software history and optional user-controlled Vault history;
- local TypeScript service — parsing, schema validation, indexes, retrieval, permissions и agent runtime;
- MCP — основной interface для внешних AI-agents;
- custom Obsidian plugin — optional thin UI adapter, не место хранения intelligence.

## 1.2. Что система сознательно НЕ делает

Ideomy не должен:

- становиться универсальным task manager;
- хранить passwords, API keys и recovery codes;
- создавать note на каждый input;
- генерировать summary ради summary;
- зависеть от одного AI provider;
- зависеть от одного community plugin;
- превращать каждый Topic в отдельную note;
- использовать embeddings как canonical memory;
- давать LLM unrestricted write access к filesystem;
- позволять AI переписывать journal history или accepted decision reasoning.

---


# 3. Core principles

1. **Capture first, classify later.**
2. **Folders are physical; Properties are semantic.**
3. **Areas answer “where in life?”, Entity Types answer “what is it?”.**
4. **Primary Area определяется intent, а не ключевыми словами.**
5. **One canonical entity, many references.**
6. **Reference, don't replicate.**
7. **Current state + immutable history.**
8. **Knowledge is synthesized, not merely summarized.**
9. **If it matters later, materialize it explicitly in the Vault.**
10. **AI performs reversible routine; humans control semantic/high-impact decisions.**
11. **Prefer typed patches over full-file rewrites.**
12. **All derived indexes are disposable and rebuildable.**
13. **Privacy enforcement happens before model selection.**
14. **External content is untrusted data, never agent instruction.**
15. **The system must remain usable if AI and community plugins are disabled.**

---


# 4. Life Ontology v1.0

## 4.1. Domains and Areas

### 01 — Self & Wellbeing

- `Self & Direction`
- `Health & Energy`
- `Learning & Development`
- `Leisure & Culture`

### 02 — Relationships

- `Relationships & Family`
- `Social & Community`

### 03 — Work & Career

- `Career`
- `Professional Practice`
- `Personal Brand & Reputation`

### 04 — Business & Creation

- `Business & Entrepreneurship`
- `Creative & Side Projects`

### 05 — Wealth

- `Money & Assets`

### 06 — Environment & Infrastructure

- `Technology & AI`
- `Digital Life`
- `Home & Household`

### 07 — Mobility & Administration

- `Travel & Mobility`
- `Legal & Administration`

Total: **7 Domains / 17 Areas**.

## 4.2. Domain vs Area

- **Domain** — навигационная группировка.
- **Area** — долгосрочная сфера ответственности.
- **Subdomain** — устойчивый аспект Area.
- **Topic** — тема знания, не контейнер.
- **Project** — конечный outcome.
- **Goal** — желаемое изменение состояния.

## 4.3. Area routing rule

```text
1. Определи object type.
2. Определи intent: зачем информация существует.
3. Определи основной долгосрочный outcome.
4. Назначь ровно 1 primary_area.
5. Добавь 0–2 related_areas, если это улучшает retrieval.
6. Если уверенность низкая — отправь поле в Review Queue.
```

## 4.4. Critical boundaries

### Career vs Professional Practice vs Personal Brand vs Business

```text
Как я выполняю работу?
→ Professional Practice

Как я развиваю карьерную траекторию?
→ Career

Как меня видит внешний профессиональный мир?
→ Personal Brand & Reputation

Как я создаю коммерческую ценность вне employment?
→ Business & Entrepreneurship
```

### Learning vs target Area

```text
Learning = процесс приобретения capability.
Knowledge = результат обучения.
```

### Technology & AI vs Digital Life

```text
Technology & AI = capability / technical systems / AI architecture.
Digital Life = ownership / accounts / subscriptions / data / device operation.
```

### Money vs Business

```text
Money & Assets = личные деньги и капитал.
Business = экономика коммерческой системы.
```

---


# 32. MVP scope

## 32.1. Full ontology is specified now

But MVP only actively uses:

```text
Area
Project
Knowledge
Source
Decision
Journal
```

Everything else may already have schema definitions but does not need full automation.

## 32.2. MVP agent skills

```text
capture
classify
entity-resolve
source-process
knowledge-synthesize
project-manage
decision-capture
review
maintain-lite
```

## 32.3. MVP retrieval

Start with:

```text
metadata
+
full-text
+
graph
+
LLM reranking
```

Do not add vector DB until real retrieval failures justify it.

---


# 49. MVP Definition of Done

The first real v1 is complete only when all of these scenarios work:

1. **Capture a thought** in under a few interactions and without classification.
2. **Capture a URL** into Inbox.
3. **Create a Project** without manually composing YAML.
4. **Ask “why did I decide X?”** and retrieve the correct Decision.
5. **Ask about an active Project** and get a bounded Project Context Pack.
6. **Process a Source** without producing redundant summary notes.
7. **Propose Knowledge** with duplicate detection.
8. **Generate Weekly Review** from system state and exceptions.
9. **See exact diff** of every meaningful agent write.
10. **Rollback an agent operation** safely.
11. **Disable AI service** and continue using the Vault normally.
12. **Delete derived indexes and rebuild them** without losing knowledge.

---


# 50. Launch scope: what to postpone

Do not implement before MVP proves useful:

- multi-agent swarm;
- full autonomous background writes;
- complex vector DB;
- graph database;
- universal task-management replacement;
- complicated bidirectional Calendar sync;
- automatic ontology evolution;
- rich People CRM automation;
- mobile heavy-agent runtime;
- rich Obsidian AI UI before Bootstrap/Core contracts are stable; the minimal Plugin required for setup/handshake is part of Bootstrap Foundation.

---


# 54. Success criteria for the system itself

The system is successful if, after it has accumulated significant data:

### Retrieval

You can ask:

```text
Что я решил по этой теме?
Что я уже знаю?
Где я применял это раньше?
Какие evidence это подтверждают?
Что изменилось с прошлого review?
```

and get answers grounded in canonical entities.

### Execution

You can say:

```text
Продолжим Project X.
```

and the agent can reconstruct state without requiring you to re-explain the project.

### Learning

Sources increasingly update existing Knowledge instead of creating isolated summaries.

### Career

Evidence from work can be reused for Resume, Portfolio, Performance Reviews and Interviews.

### Maintenance

The system surfaces exceptions and debt without requiring constant manual taxonomy cleanup.

### Independence

Changing AI provider, disabling plugins or rebuilding indexes does not destroy the Ideomy.

---


# 57. Product Delivery & Time-to-Value

## 57.1. Product perception

Ideomy must be perceived as a standalone **Personal Knowledge OS**, not as an “Obsidian template with AI”. Obsidian is the initial knowledge interface and ecosystem advantage; it is not the core value proposition.

## 57.2. Delivery evolution

```text
Development
→ Bootstrap CLI
→ Alpha terminal setup
→ Private Beta single-command setup
→ Public Beta official Plugin + signed Core installed by CLI bootstrap
→ post-PMF decision: remain Obsidian-native vs standalone desktop/native installer
```

## 57.3. Target onboarding

A new or existing Obsidian user should reach a useful Ideomy state in **≤ 5 minutes** in V1.

Primary choices:

```text
Start fresh
OR
Use existing Obsidian Vault
```

For existing Vaults, Ideomy adds a semantic/intelligence layer without requiring immediate reorganization into the canonical folder structure.

## 57.4. Packaging principle

User-visible product:

> **Ideomy**

Internal/distribution artifacts may include Plugin, Core and Vault template, but onboarding must not make the user assemble these manually. The canonical V1 UX is one terminal bootstrap (`ideomy setup` or an equivalent package-manager entry point), not a separate native installer application.

# 18. AI access modes

Ideomy is valuable without LLM availability. AI is an optional intelligence layer added after the deterministic Vault/retrieval/mutation substrate is stable.

Supported product modes:

```text
Deterministic-only
  Vault + ontology + graph + search + reviews without LLM

Direct Provider
  Ideomy Core → Model Gateway → OpenAI / Anthropic / Gemini / compatible API

Local Inference
  Ideomy Core → Model Gateway → LM Studio / Ollama / compatible local endpoint

External AI Host
  ChatGPT / Claude / other MCP host → Ideomy MCP → Vault context/tools
```

A ChatGPT/Claude consumer subscription is not treated as a reusable Ideomy API entitlement. Subscription-host mode means the external host runs the model and calls Ideomy through supported MCP/app mechanisms. Ideomy-native autonomous/background Agent work requires a direct provider/local endpoint available to Core.

Recommended end state: **Hybrid** — local/private inference for sensitive/routine work, strong cloud reasoning when permitted, and MCP for users who prefer working from external AI hosts.

## CLI role

Ideomy CLI is the canonical V1 installation/admin/automation surface, not the primary knowledge-work UI. Ordinary knowledge work remains in Obsidian + Ideomy Plugin; the CLI optimizes setup, status, diagnostics, updates and advanced administration.



# Obsidian Plugin product role

Ideomy Plugin is the primary in-context Obsidian product surface, while Ideomy Core remains the separate intelligence/runtime layer. V1 product experience must hide this modularity during normal use: users interact with Ideomy, not with a “plugin + daemon” assembly.


## Implementation Readiness reference

Product requirements are implemented against machine schemas/fixtures from `20_VAULT_IO_AND_SCHEMA` and engineering baseline in `22_ENGINEERING_FOUNDATION`.

---

<!-- SOURCE: 02_ARCHITECTURE__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ideomy Architecture


## 1. Architecture goal

Ideomy is a **local-first Personal Knowledge OS**. The architecture separates canonical user-owned knowledge from derived indexes, UI clients and replaceable model providers.

## 2. System topology

```text
Obsidian
  ↕
Ideomy Plugin ─────────────┐
                          │ versioned authenticated local protocol
Ideomy CLI ────────────────┤
                          ▼
                      Ideomy Core
                 ┌────────┼─────────┐
                 ▼        ▼         ▼
              Vault I/O  Index    Agent/Models
                 │        │         │
                 ▼        │         └─ Model Gateway → cloud/local
        External Personal Vault
                 │
                 └─ Markdown / attachments / Obsidian config

External AI hosts
(ChatGPT/Claude/Codex/...)
        ↓ MCP
     Ideomy Core
```

## 3. Canonical vs derived state

### Canonical

```text
Personal Vault Markdown
Attachments
accepted Decisions / Journal / Records
portable system notes/config explicitly defined as canonical
```

### Derived / disposable

```text
SQLite entity/index database
FTS index
Graph adjacency index
embeddings/vector index if later added
Core caches
operation progress state
```

Invariant:

```text
delete derived state
→ rebuild from Vault
→ no canonical knowledge loss
```

Transaction journal may retain recovery snapshots outside the Vault according to `20 VAULT_IO_AND_SCHEMA`; it is recovery state, not a second knowledge source of truth.

## 4. Software repository boundary

Canonical repo name:

```text
ideomy
```

It is a pnpm/TypeScript monorepo containing Core, CLI, Plugin and shared contracts. The old working name `ideomy-core` is superseded.

Production Personal Vault lives outside the repo. Tests/evals use only committed synthetic fixtures.

## 5. Application boundaries

### Ideomy Core

Owns:

```text
Vault parser/write layer
schema normalization/validation
SQLite/FTS index
graph derivation
retrieval / Context Packs
transaction journal / optimistic concurrency
Agent runtime / skills
Model Gateway
MCP server
local protocol server
background jobs
```

### Ideomy Plugin

Owns:

```text
Obsidian-native UI
active-note/selection pointers
commands/ribbon/context actions
Review/Diff interaction
Core connection/degraded state
lightweight offline Inbox Capture
```

It does not own canonical parsing/indexing/models/MCP.

### Ideomy CLI

Owns:

```text
setup/status/doctor/repair/update/uninstall UX
Core lifecycle administration
Vault/index/config diagnostics
non-interactive automation interface
```

CLI handlers orchestrate typed packages; they do not duplicate domain logic.

## 6. Vault-managed vs unmanaged notes

Ideomy does not require every existing Obsidian note to become an Ideomy Entity.

```text
unmanaged note
→ readable/indexable document
→ never silently rewritten as Entity

managed Ideomy Entity
→ ideomy_schema + immutable id + type
→ validates against Entity schema
→ eligible for typed mutations
```

Adoption of existing notes is explicit or policy-approved and previewable. See `20 VAULT_IO_AND_SCHEMA`.

## 7. Core local protocol

V1 uses a versioned semantic protocol defined in `21_CORE_PROTOCOL`:

```text
loopback HTTP/JSON
+ SSE for events/streaming
+ machine-local discovery
+ authenticated session for sensitive operations
+ Vault identity binding
```

UI code consumes `CoreClient`; raw endpoint calls are not spread through Plugin/CLI code.

## 8. Privacy boundary

Policy evaluation occurs **before** context leaves the Core boundary.

```text
request
→ resolve relevant content
→ sensitivity / agent_access
→ minimize context
→ select allowed provider/local route
→ model call
```

`local_only` can never cloud-fallback. `denied` is not retrieved into model context.

## 9. Model boundary

All Ideomy-native model calls pass through Model Gateway. Skills request capability profiles rather than provider/model names.

External subscription-host paths are separate:

```text
ChatGPT/Claude/etc.
→ Ideomy MCP
→ Core
```

A consumer subscription is not assumed to be a direct API entitlement.

## 10. Write boundary

Canonical writes use:

```text
read + content hash
→ permission/risk check
→ typed mutation plan
→ transaction snapshot/journal
→ atomic file replace
→ reparse + schema/link validation
→ structural diff
→ commit transaction OR rollback
```

High-risk mutations remain review-bound regardless of model confidence.

## 11. Platform boundary

Core/CLI use platform adapters for:

```text
config/state paths
Core lifecycle/autostart
credential store
file permissions
process discovery
Obsidian discovery/control
```

M0/Alpha implements macOS first. Windows/Linux adapters follow the same contracts and are added later without changing domain packages.

Plugin remains mobile-compatible and Core-independent at load time; mobile V1 provides reduced/offline capabilities.

## 12. Dependency direction

```text
obsidian-plugin → core-client → contracts
cli            → bootstrap/core-client/platform → contracts
core           → vault/schema/index/graph/retrieval/transactions/model-gateway → contracts
```

Forbidden:

```text
Plugin → Core server implementation
Core → Obsidian API
contracts → platform/UI/provider SDK
Agent skill → provider SDK directly
```

## 13. Security boundary

Untrusted data includes:

```text
notes
PDF/web/email content
MCP/tool responses
imported metadata
external model output
```

Untrusted data never becomes instructions/policy. Core protocol auth and Vault fingerprint checks are required for sensitive local operations.

## 14. Architecture Definition of Done for M0/M1

Before generative features:

- external Vault boundary enforced;
- parser/schema round-trip golden tests pass;
- Core protocol handshake/auth works;
- CLI/Plugin do not bypass Core contracts;
- index rebuilds from Vault;
- typed mutation rollback works;
- production data absent from repo/CI;
- no LLM required for system health.

---

<!-- SOURCE: 03_ONTOLOGY_DATA_MODEL__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ontology & Data Model


## 1. Purpose

This document defines the logical ontology. **Executable frontmatter schemas and file I/O semantics are normative in `schemas/` and `20_VAULT_IO_AND_SCHEMA`.**

Folders organize files physically. Meaning lives in typed properties, IDs and relations.

## 2. Life Ontology

### 7 Domains / 17 Areas

### Self & Wellbeing

- `Self & Direction`
- `Health & Energy`
- `Learning & Development`
- `Leisure & Culture`

### Relationships

- `Relationships & Family`
- `Social & Community`

### Work & Career

- `Career`
- `Professional Practice`
- `Personal Brand & Reputation`

### Business & Creation

- `Business & Entrepreneurship`
- `Creative & Side Projects`

### Wealth

- `Money & Assets`

### Environment & Infrastructure

- `Technology & AI`
- `Digital Life`
- `Home & Household`

### Mobility & Administration

- `Travel & Mobility`
- `Legal & Administration`


### Area routing

```text
object type
→ intent / why this information exists
→ one primary_area
→ 0–2 related_areas when retrieval benefits
→ ambiguity → Review Queue
```

## 3. Information Ontology

First-class Entity Types:

```text
area
project
goal
knowledge
source
person
organization
decision
meeting
event
record
asset
place
journal
system
```

Not first-class in v1:

```text
Task Topic Tag Idea Document Standard Metric Inbox
```

They are state/properties/subtypes/formats/workflow concepts.

## 4. Managed-note contract

A permanent managed Ideomy Entity MUST have:

```yaml
ideomy_schema: 1
id: <type-prefix>_<ULID>
type: <entity-type>
created: <ISO-8601 datetime>
updated: <ISO-8601 datetime>
sensitivity: private
agent_access: allowed
```

Type-specific required fields come from `schemas/entities/*.schema.json`.

### Unmanaged existing note

An existing Obsidian note without `ideomy_schema` is not invalid. It can be indexed as an unmanaged document and linked/read. Core does not apply Entity mutation contracts until the note is explicitly adopted.

This distinction prevents Ideomy from forcing schema onto an existing Vault.

## 5. Identity

Canonical machine identity is immutable and opaque:

```text
<type-prefix>_<ULID>
```

Examples:

```text
prj_01K7...
kn_01K7...
dec_01K7...
per_01K7...
```

Human-readable filename/title and optional `slug` may change. ID must not encode title, date semantics or path.

Legacy semantic IDs from pre-v0.9 specs are superseded before production data exists.

## 6. Canonical type prefixes

```text
area  area_
project prj_
goal gol_
knowledge kn_
source src_
person per_
organization org_
decision dec_
meeting mtg_
event evt_
record rec_
asset ast_
place plc_
journal jrn_
system sys_
```

## 7. Common logical properties

```text
ideomy_schema
id
type
subtype
status
aliases
primary_area
related_areas
topics
projects
goals
people
organizations
places
sources
decisions
created
updated
sensitivity
agent_access
```

Cardinality:

| Property | Rule |
|---|---|
| `primary_area` | 0..1 |
| `related_areas` | 0..2 |
| `topics` | 0..10; preferred 2–6 |
| typed entity-link lists | 0..n |

## 8. Property mapping for existing Vaults

Ideomy defines **logical property names**. A new Ideomy Vault uses those names physically.

An existing Vault may configure a mapping when a physical property collides with user semantics, e.g.:

```text
logical `status` → physical `ideomy_status`
```

Core normalizes physical frontmatter through the profile mapping before logical schema validation. Mapping changes require an explicit migration/preview; skills operate only on logical names.

## 9. Relation representation

Vault-facing relations use Obsidian wikilinks in properties where practical:

```yaml
primary_area: "[[Professional Practice]]"
projects:
  - "[[Build Ideomy v1]]"
```

Core resolves links to stable entity IDs and stores ID-based edges in the derived graph/index. Filename/path changes therefore do not change entity identity.

Allowed source/target types are machine-readable in `schemas/relationships.json`.

## 10. Lifecycles

| Entity | Lifecycle |
|---|---|
| Project | idea → planned → active → waiting/paused → completed/cancelled |
| Goal | draft → active → paused → achieved/abandoned |
| Knowledge | seed → developing → evergreen → deprecated/superseded |
| Source | inbox → queued → consuming → processed → archived |
| Decision | proposed → accepted → implemented/rejected/superseded |
| Meeting | scheduled → completed → processed/cancelled |
| Event | planned → completed/cancelled |
| Record | recorded → verified → superseded/invalid |
| Asset | planned → active → maintenance → sold/retired/lost |
| Journal | open → reviewed → closed |
| System | draft → active → deprecated |

Area/person/organization/place may use `active/inactive/archived` where appropriate; exact enums are in schema artifacts.

## 11. Dates

Machine storage:

```text
YYYY-MM-DDTHH:mm:ss±HH:mm
```

Date-only fields use `YYYY-MM-DD`. Never fabricate missing time/date precision.

## 12. Sensitivity / Agent access

```text
sensitivity: public | internal | private | sensitive
agent_access: allowed | restricted | local_only | denied
```

Secrets never belong in the Vault.

## 13. Vault architecture — new Ideomy Vault

```text
00 System/
01 Inbox/
10 Projects/
11 Goals/
20 Knowledge/
21 Sources/
30 People/
31 Organizations/
32 Places/
40 Decisions/
41 Meetings/
42 Events/
43 Records/
50 Assets/
60 Journal/
80 Attachments/
90 Archive/
```

An existing Vault is not required to adopt this physical layout.

## 14. Human naming

Filename = human-readable title. ID is stored in frontmatter.

Temporal filenames:

```text
Decision: YYYY-MM-DD — Title.md
Meeting:  YYYY-MM-DD — Topic — Person.md
Daily:    YYYY-MM-DD.md
Weekly:   YYYY-Www.md
```

## 15. Executable schemas

Normative artifacts:

```text
schemas/base.schema.json
schemas/registry.json
schemas/relationships.json
schemas/entities/*.schema.json
```

Rules:

- `additionalProperties` is allowed at raw Vault boundary to preserve user fields;
- Ideomy-owned logical properties must validate when present;
- type-specific required fields are enforced only on managed entities;
- unknown/user properties are preserved round-trip;
- error vs warning rules live in `20_VAULT_IO_AND_SCHEMA`.

## 16. Templates / examples

Canonical starter artifacts live under `vault-template/`. Synthetic executable examples live under `fixtures/test-vault/`.

The prose examples in this document are explanatory; machine fixtures are used for parser/schema tests.

---

<!-- SOURCE: 04_KNOWLEDGE_INTELLIGENCE__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Knowledge Intelligence & Retrieval



## 1. Purpose

Ideomy intelligence is not “summarize everything”. The system should reduce entropy: turn inputs into a smaller set of reusable, connected knowledge while preserving provenance.

## 2. Knowledge transformation

```text
Capture
→ Source
→ extract claims/concepts
→ compare with existing knowledge
→ New / Extends / Confirms / Contradicts
→ update existing or propose new Knowledge
→ connect to Projects/Areas/Decisions
```

A processed Source may produce **zero** new Knowledge; that is a valid outcome.

## 3. Knowledge quality gate

A new Knowledge entity should be mostly:

- novel;
- reusable beyond the source/project;
- independently understandable;
- sufficiently specific;
- durable enough to matter later;
- connected to existing context.

## 4. Retrieval principle

Scope/ontology first, embeddings later. Retrieval combines structured filtering, lexical search, semantic search when justified, graph expansion, reranking and context compression.

## 5. Canonical knowledge/retrieval/review sections

# 12. Operating Model v1.0

```text
Capture
→ Triage
→ Process
→ Normalize
→ Classify
→ Connect
→ Synthesize
→ Use / Act
→ Review
→ Maintain
→ Archive / Retain
```

Не каждый input проходит полный pipeline.

## 12.1. Core role split

```text
Human:
capture
decide
reflect
approve semantics

Agent:
process
normalize
connect
retrieve
surface
maintain
```

## 12.2. Inbox processing

```text
1 Understand
2 Deduplicate
3 Determine object type
4 Determine intent
5 Classify Area
6 Extract Topics
7 Resolve entities
8 Connect relationships
9 Determine destination
10 Validate
11 Write
12 Log operation
```

## 12.3. Source → Knowledge

```text
Source
↓
Extract claims
↓
Compare against existing Knowledge
↓
New / Extends / Confirms / Contradicts
↓
Reusable?
↓
Update existing Knowledge
or
propose new Knowledge
↓
Connect to Projects / Areas
↓
Mark Source processed
```

The goal is synthesis, not summary farming.

## 12.4. Project lifecycle

```text
idea
→ planned
→ active
→ waiting / paused
→ completed / cancelled
```

Completion gate:

```text
Definition of Done satisfied?
Deliverables present?
Open actions resolved?
Decisions captured?
Reusable Knowledge extracted?
Evidence captured?
Retrospective complete?
```

## 12.5. Review hierarchy

```text
Daily      → timeline/capture
Weekly     → operational
Monthly    → tactical/patterns
Quarterly  → strategic
Yearly     → trajectory/direction
```

Weekly Review is the main human-in-the-loop maintenance cycle.

---


# 17. Retrieval Architecture

Vector search alone is insufficient.

```text
Request
↓
Intent Detection
↓
Entity Resolution
↓
Scope Selection
↓
Structured Metadata Filtering
↓
Lexical + Semantic Search
↓
Graph Expansion
↓
Reranking
↓
Context Compression
↓
Context Pack
```

## 17.1. Retrieval priority prior

Usually:

```text
canonical entity
>
accepted decision
>
evergreen knowledge
>
verified record
>
project
>
processed source
>
meeting
>
journal
>
raw inbox
```

This is a ranking prior, not an absolute rule.

## 17.2. Context Packs

Runtime object types:

```text
project
area
person
topic
decision
review
system
```

Example Project Context Pack:

```text
Project Summary
Current State
Goal
Recent Decisions
Relevant Knowledge
Recent Activity
People
Constraints
Open Questions
```

---


# 18. Memory model

The system has multiple memory layers:

```text
L0 Conversation Context
L1 Runtime Context Pack
L2 Canonical Vault
L3 Explicit Agent Policies
L4 Transaction / Working State
```

Only L2 and L3 are durable.

Rule:

> If a correction matters later, convert it into an explicit Vault fact or policy.

---


# 43. System Health

## 43.1. Integrity

```text
invalid schemas
duplicate IDs
broken links
unknown enum values
```

## 43.2. Flow

```text
Inbox backlog
Source backlog
Review Queue
stale Projects
```

## 43.3. Knowledge quality

```text
old seeds
orphan Knowledge
duplicate candidates
contradiction candidates
```

## 43.4. Safety

```text
failed transactions
rollbacks
permission denials
unexpected agent writes
```

Health states:

```text
Healthy
Attention
Degraded
```

Do not invent fake `73/100` precision.

---


# 44. Recommended initial thresholds

These are operational defaults, not universal truths.

```text
Inbox:
0–20        Healthy
21–50       Attention
>50         Review backlog

Active Project stale:
>14 days without meaningful update

Knowledge seed stale:
>30 days

Source backlog:
>21 days unprocessed

Broken canonical links:
target = 0
```

Adjust after real usage.

---


# 45. Human correction feedback loop

```text
Agent proposes classification
↓
Human corrects
↓
Correction logged
↓
Pattern repeats?
↓
Yes
↓
Update explicit Classification Policy
↓
Add regression eval
```

This is preferred over relying on opaque model memory.

---


# 54. Success criteria for the system itself

The system is successful if, after it has accumulated significant data:

### Retrieval

You can ask:

```text
Что я решил по этой теме?
Что я уже знаю?
Где я применял это раньше?
Какие evidence это подтверждают?
Что изменилось с прошлого review?
```

and get answers grounded in canonical entities.

### Execution

You can say:

```text
Продолжим Project X.
```

and the agent can reconstruct state without requiring you to re-explain the project.

### Learning

Sources increasingly update existing Knowledge instead of creating isolated summaries.

### Career

Evidence from work can be reused for Resume, Portfolio, Performance Reviews and Interviews.

### Maintenance

The system surfaces exceptions and debt without requiring constant manual taxonomy cleanup.

### Independence

Changing AI provider, disabling plugins or rebuilding indexes does not destroy the Ideomy.

---


## Implementation contract references

Knowledge operations use managed/unmanaged/schema/transaction semantics from `20_VAULT_IO_AND_SCHEMA`; retrieval implementation follows the normalized roadmap in `11_IMPLEMENTATION`.

## Web Capture pipeline

Web content follows the same ingestion doctrine as other Sources:

```text
capture raw provenance/content
→ Inbox/Web
→ normalize URL + metadata
→ duplicate/entity resolution
→ decide create/update Source
→ classify/connect
→ synthesize Knowledge only if reusable/new
→ review ambiguous/high-impact outcomes
```

`Capture ≠ Source ≠ Knowledge`. A clipped page may produce no new Knowledge, may enrich an existing Source, or may be retained only as an Inbox capture until processed.

---

<!-- SOURCE: 05_AGENT_RUNTIME__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Agent Runtime & Tooling



## 1. Runtime model

Ideomy uses **one bounded orchestrator with composable skills**, not a multi-agent swarm.

```text
Intent
→ risk + privacy
→ select skill/workflow
→ retrieve minimum context
→ plan if needed
→ execute typed tools
→ validate
→ diff / approval
→ commit / rollback
```

## 2. Write philosophy

Prefer semantic mutations (`setProperty`, `appendRelation`, `replaceAutoSection`) over whole-file regeneration. The LLM does not get unrestricted filesystem, shell, SQL or arbitrary network access.

## 3. Canonical runtime sections

# 13. Agent permission model

## 13.1. Action levels

```text
L0 Read
L1 Analyze
L2 Suggest
L3 Auto + Log
L4 Autonomous
L5 Forbidden
```

## 13.2. Typical L4

- validate metadata;
- normalize topic spelling;
- update agent-owned dynamic sections;
- detect broken links;
- rebuild indexes;
- calculate system health.

## 13.3. Typical L3

- classify high-confidence Inbox item;
- add obvious relationship;
- extract straightforward metadata;
- move processed Source;
- rename malformed attachment.

## 13.4. Typical L2

- create Evergreen Knowledge;
- create Goal;
- merge notes;
- change Primary Area;
- close major Project;
- change Area health;
- supersede Decision.

## 13.5. L5

- rewrite historical Journal;
- rewrite accepted Decision rationale;
- delete canonical Knowledge automatically;
- leak restricted/local-only data;
- store secrets.

---


# 14. Risk model

Automation decision is based on:

```text
Confidence × Cost of mistake
```

Example:

| Operation | Confidence | Risk | Default |
|---|---:|---:|---|
| Add topic | high | low | auto |
| Add obvious Project link | high | low | auto + log |
| Change Primary Area | high | medium | suggest/log |
| Merge Knowledge | very high | high | approval |
| Delete verified Record | certain | high | forbidden by default |

---


# 15. Review Queue

Review Queue is a **dynamic view**, not a new Entity Type.

Categories:

```text
Classification
Knowledge candidates
Merge candidates
Area health
Project completion
Conflicts
Permission-sensitive changes
```

Target UX:

```text
Safe changes        17
Needs decision       4
Conflicts            2

[Approve safe]
```

Approval is batch-oriented, not interrupt-driven.

---


# 16. AI Agent Architecture v1.0

```text
USER
 ↓
IDEOMY ORCHESTRATOR
 ↓
INTENT / PLAN / RISK
 ↓
SKILLS
 ↓
RETRIEVAL + CONTEXT PACK
 ↓
POLICY + PERMISSIONS
 ↓
TYPED TOOLS
 ↓
VAULT
 ↓
VALIDATION + TRANSACTION LAYER
```

## 16.1. Core skills

1. `capture`
2. `classify`
3. `entity-resolve`
4. `connect`
5. `source-process`
6. `knowledge-synthesize`
7. `project-manage`
8. `decision-capture`
9. `review`
10. `maintain`

Area-specific agents are not created by default.

## 16.2. Skill contract

Each skill defines:

```text
purpose
inputs
preconditions
read scope
write scope
allowed tools
algorithm
output schema
validation
permissions
failure behavior
examples
version
```

---


# 19. Privacy and prompt-injection policy

## 19.1. Privacy sequence

```text
candidate retrieval
↓
agent_access filter
↓
sensitivity filter
↓
model selection
↓
context assembly
↓
LLM
```

Never retrieve all content first and rely on prompt instructions after exposure.

## 19.2. External content is untrusted

Content from:

- web pages;
- PDFs;
- email;
- meeting transcripts;
- pasted text;
- imported files

can never override:

```text
system schema
agent policy
permissions
workflow
```

Instructions inside Sources are treated as data.

---


# 20. Agent-owned vs human-owned content

Human-owned by default.

Agent may autonomously edit only explicit dynamic sections:

```markdown
<!-- BEGIN AUTO:active-projects -->

...

<!-- END AUTO:active-projects -->
```

No marker → human-owned.

Mutation rule:

> Prefer the smallest possible structured patch over regeneration of a full file.

---


# 21. Transaction model

Any write operation:

```text
Prepare
↓
Check permissions
↓
Read current hash
↓
Transaction snapshot
↓
Prepare typed mutations
↓
Dry validation
↓
Apply atomically
↓
Parse again
↓
Schema validation
↓
Link validation
↓
Diff
↓
Commit transaction or Review
```

Concurrent modification:

```text
hash changed since read
→ conflict
→ re-read
→ rebase patch or Review Queue
```

---


# 28. Typed mutation API

The agent never receives arbitrary filesystem writes as its primary API.

Preferred tools:

```text
vault.read_entity
vault.read_section
vault.search

vault.create_entity

vault.set_property
vault.add_property_link
vault.remove_property_value

vault.replace_auto_section
vault.append_journal_entry

vault.move_entity

schema.validate
entity.resolve

transaction.snapshot
transaction.diff
transaction.commit
transaction.rollback
```

Avoid:

```text
write_file(full_document)
shell(arbitrary_command)
```

for ordinary agent operations.

---


# 29. MCP Interface v1

Initial read tools:

```text
ideomy.search
ideomy.get_entity
ideomy.get_context
ideomy.system_health
```

Initial write workflows:

```text
ideomy.capture
ideomy.process_inbox
ideomy.propose_change
ideomy.get_review_queue
ideomy.approve
ideomy.reject
ideomy.rollback
```

High-level tools are preferred to raw filesystem primitives.

---


# 30. Local API v1

The optional Obsidian plugin can communicate with the service over localhost.

Minimal endpoints:

```text
GET  /health
POST /search
GET  /entities/:id
POST /agent/run

GET  /review-queue
POST /review/:id/approve
POST /review/:id/reject

GET  /system-health
GET  /transactions/:id
POST /transactions/:id/rollback
```

The endpoint design is implementation detail; MCP remains the primary external-agent interface.

---

# 31. Model Gateway boundary

The Orchestrator/skills do not call model providers directly.

```text
Skill
→ required capability/profile
→ privacy/risk policy
→ Model Gateway
→ selected provider/model
→ structured result
→ schema/claim validation
```

Skill manifests may declare requirements such as:

```text
profile: fast | balanced | reasoning | local-private | embedding
structured_output: required
 tools: required | optional | none
minimum_context: <tokens>
```

They must not encode `gpt-*`, `claude-*`, `gemini-*`, Ollama model tags or provider API keys as domain behavior.

External-host MCP use is not an internal Model Gateway provider: the external host owns inference and calls Ideomy tools/context through MCP.


## Implementation contract references

Agent tools call typed Vault/transaction contracts and Core protocol packages; they do not receive raw filesystem/network/provider SDK access. See `20`, `21`, `22`.

---

<!-- SOURCE: 06_SKILLS__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Skill Registry & Contracts



## 1. Skill model

A skill is an executable workflow contract, not a prompt/persona. Every skill must specify:

```text
name + version
purpose
inputs
preconditions
read scope
write scope
allowed tools
risk class
algorithm / steps
output schema
validation
failure behavior
evals
```

A prompt-only skill is incomplete.

## 2. Core skill registry

| Skill | Purpose | Default write risk |
|---|---|---|
| `capture` | preserve an input as Inbox item with provenance | low |
| `classify` | type/subtype/Area/topics routing | low–medium |
| `entity-resolve` | match mentions to canonical entities; prevent duplicates | medium |
| `connect` | add meaningful typed relationships | low–medium |
| `source-process` | process Source and derive knowledge candidates | medium |
| `knowledge-synthesize` | compare multiple sources/notes and update knowledge model | medium–high |
| `project-manage` | assemble project state/context; propose state changes | medium |
| `decision-capture` | create decision candidate with context/options/rationale | medium |
| `review` | weekly/monthly/area/system exception-driven review | low–medium |
| `maintain` | schema/link/ID/staleness/duplicate/system health checks | low |

## 3. Skill contracts

### `capture`

**Input:** text/URL/file/voice transcript.  
**Reads:** minimal capture config only.  
**Writes:** `01 Inbox`.  
**Must:** preserve original content and provenance.  
**Must not:** deeply classify or synthesize synchronously.

### `classify`

**Input:** Inbox/permanent entity candidate.  
**Reads:** Schemas, Areas, taxonomy, relevant existing entity metadata.  
**Output:** `type`, `subtype`, `primary_area`, max 2 `related_areas`, normalized topics.  
**Must not:** invent new Areas/entity types/properties.  
**Ambiguity:** route field/item to Review Queue.

### `entity-resolve`

Resolution order:

```text
stable ID / exact canonical identity
→ aliases
→ normalized title
→ structured context
→ semantic similarity
→ ambiguous review
```

Never create `Entity 2` before duplicate/entity-resolution check.

### `connect`

Adds typed relations only when they materially improve retrieval/context. Avoid keyword-driven link spam. Key relations use typed properties; backlinks are secondary evidence.

### `source-process`

```text
Source
→ acquire/preserve
→ identify claims/concepts
→ compare to existing Knowledge
→ classify New/Extends/Confirms/Contradicts
→ update/propose
→ link project/context
→ mark processed
```

`processed` means useful information was extracted or consciously discarded, not merely “read”.

### `knowledge-synthesize`

High creation threshold. Prefer update/merge proposal over proliferating atomic notes. It may flag contradictions but may not silently delete/merge canonical Knowledge.

### `project-manage`

Build Project Context Pack from Project + Goal + Area + accepted Decisions + recent activity + relevant Knowledge + People/Organizations + open questions. It may propose pause/complete/cancel; significant state changes require review.

### `decision-capture`

Trigger when future self is likely to ask “why?”. Captures Context, Problem, Constraints, Options, Decision, Rationale, Trade-offs, Consequences, Review Trigger. Accepted reasoning is historical and not silently rewritten.

### `review`

Subtypes: `weekly`, `monthly`, `quarterly`, `yearly`, `area`, `project`, `system`. Output is exception/decision oriented: changes, patterns, stale items, decisions required — not a long generic summary.

### `maintain`

Checks: invalid schema, broken links, duplicate IDs, stale projects, old seeds, unprocessed sources, duplicate candidates, overdue reviews, taxonomy fragmentation, unexpected mutation patterns.

## 4. Composition rules

Allowed acyclic composition examples:

```text
source-process
├── entity-resolve
├── classify
├── connect
└── knowledge-synthesize

review
├── maintain (read/analyze)
├── project-manage (read/analyze)
└── retrieval
```

A low-level skill may not recursively invoke a high-level ingestion workflow that could create cycles.

## 5. Skill versioning

SemVer per skill:

- PATCH: instruction/rule refinement without contract change;
- MINOR: additive capability/output field;
- MAJOR: breaking contract/permission/workflow change.

Any model/prompt/skill update that changes behavior requires relevant evals before promotion.

## 6. Definition of Done — skill

A skill is accepted only when:

- typed input/output exists;
- read/write scopes explicit;
- permissions/risk explicit;
- schemas validate;
- idempotency considered;
- failure behavior explicit;
- tests/evals exist;
- docs/examples exist;
- no hidden taxonomy mutation.

## 7. Related canonical sections

# 12. Operating Model v1.0

```text
Capture
→ Triage
→ Process
→ Normalize
→ Classify
→ Connect
→ Synthesize
→ Use / Act
→ Review
→ Maintain
→ Archive / Retain
```

Не каждый input проходит полный pipeline.

## 12.1. Core role split

```text
Human:
capture
decide
reflect
approve semantics

Agent:
process
normalize
connect
retrieve
surface
maintain
```

## 12.2. Inbox processing

```text
1 Understand
2 Deduplicate
3 Determine object type
4 Determine intent
5 Classify Area
6 Extract Topics
7 Resolve entities
8 Connect relationships
9 Determine destination
10 Validate
11 Write
12 Log operation
```

## 12.3. Source → Knowledge

```text
Source
↓
Extract claims
↓
Compare against existing Knowledge
↓
New / Extends / Confirms / Contradicts
↓
Reusable?
↓
Update existing Knowledge
or
propose new Knowledge
↓
Connect to Projects / Areas
↓
Mark Source processed
```

The goal is synthesis, not summary farming.

## 12.4. Project lifecycle

```text
idea
→ planned
→ active
→ waiting / paused
→ completed / cancelled
```

Completion gate:

```text
Definition of Done satisfied?
Deliverables present?
Open actions resolved?
Decisions captured?
Reusable Knowledge extracted?
Evidence captured?
Retrospective complete?
```

## 12.5. Review hierarchy

```text
Daily      → timeline/capture
Weekly     → operational
Monthly    → tactical/patterns
Quarterly  → strategic
Yearly     → trajectory/direction
```

Weekly Review is the main human-in-the-loop maintenance cycle.

---


# 16. AI Agent Architecture v1.0

```text
USER
 ↓
IDEOMY ORCHESTRATOR
 ↓
INTENT / PLAN / RISK
 ↓
SKILLS
 ↓
RETRIEVAL + CONTEXT PACK
 ↓
POLICY + PERMISSIONS
 ↓
TYPED TOOLS
 ↓
VAULT
 ↓
VALIDATION + TRANSACTION LAYER
```

## 16.1. Core skills

1. `capture`
2. `classify`
3. `entity-resolve`
4. `connect`
5. `source-process`
6. `knowledge-synthesize`
7. `project-manage`
8. `decision-capture`
9. `review`
10. `maintain`

Area-specific agents are not created by default.

## 16.2. Skill contract

Each skill defines:

```text
purpose
inputs
preconditions
read scope
write scope
allowed tools
algorithm
output schema
validation
permissions
failure behavior
examples
version
```

---


# 40. Phase 7 — Build evaluation harness

Create a regression set under:

```text
00 System/Agent/Evals/
```

or in the code repo with synthetic/private-safe fixtures.

Core suites:

```text
classification
entity_resolution
knowledge_creation
retrieval
permissions
prompt_injection
decision_extraction
schema_validation
```

### Example eval

```text
Input:
"Как встроить Figma MCP в рабочий дизайн-процесс?"

Expected:
primary_area = Professional Practice
related_area = Technology & AI
```

### Metrics

Track:

```text
classification override rate
duplicate prevention
retrieval success
permission violations
schema errors
rollback count
Review Queue size
```

### Exit criteria

- model/prompt change cannot ship without regression run;
- privacy and prompt-injection tests pass;
- human correction patterns can be traced back to specific routing rules.

---

# 12. Model capability contracts

Each generative skill declares **capabilities**, not vendor identity.

Minimum contract fields where relevant:

```text
model_profile
requires_structured_output
requires_tool_use
requires_streaming
minimum_context
privacy_ceiling
fallback_allowed
```

Default MVP sequencing:

1. `classify` — first LLM-backed structured-output skill;
2. `connect` — retrieval candidates + model relation/rerank proposal;
3. `ask` — Context Pack → answer with provenance;
4. `source-process` / `knowledge-synthesize` — deeper reasoning after retrieval/evals are stable.

A skill remains incomplete if its behavior is only known to work with one named model and lacks provider/local conformance evals.


## Implementation contract references

Skill input/output types must be implemented in shared contracts and validated against executable schema/protocol boundaries before model execution. See `20`, `21`, `22`.

## Web capture skill boundary

`capture` may preserve a browser capture envelope, but it does not convert the clip directly into canonical semantic entities.

`source-process`/entity-resolution workflows consume the capture later and may:

```text
attach to existing Source
create Source candidate
extract Knowledge candidate
return "nothing new"
```

A browser frontend never owns these semantic decisions.

---

<!-- SOURCE: 07_CONTEXT_MEMORY__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Context & Memory Model



## 1. Memory is layered, not universal

Ideomy does not use one opaque “agent memory”.

```text
L0 Conversation Context      transient
L1 Runtime Context Pack      transient
L2 Canonical Vault           durable source of truth
L3 Explicit Agent Policies   durable behavioral rules
L4 Transaction Working State ephemeral/auditable
```

If information matters later, it must be materialized explicitly in the Vault or policy/spec — not assumed to survive in model memory/chat history.

## 2. Context Pack

Runtime construct, never canonical entity. Typical packs:

- Project;
- Area;
- Person;
- Topic/Knowledge;
- Decision;
- Review;
- System.

Context collection is hierarchical and minimum-necessary: resolve intent/scope first, then retrieve/expand.

## 3. Policy learning

Repeated human corrections may become explicit policy candidates (for example routing rules), but are not silently embedded as opaque memory. Accepted rule changes belong in `Classification Policy`, schema/taxonomy docs or ADR.

## 4. Canonical context/memory sections

# 17. Retrieval Architecture

Vector search alone is insufficient.

```text
Request
↓
Intent Detection
↓
Entity Resolution
↓
Scope Selection
↓
Structured Metadata Filtering
↓
Lexical + Semantic Search
↓
Graph Expansion
↓
Reranking
↓
Context Compression
↓
Context Pack
```

## 17.1. Retrieval priority prior

Usually:

```text
canonical entity
>
accepted decision
>
evergreen knowledge
>
verified record
>
project
>
processed source
>
meeting
>
journal
>
raw inbox
```

This is a ranking prior, not an absolute rule.

## 17.2. Context Packs

Runtime object types:

```text
project
area
person
topic
decision
review
system
```

Example Project Context Pack:

```text
Project Summary
Current State
Goal
Recent Decisions
Relevant Knowledge
Recent Activity
People
Constraints
Open Questions
```

---


# 18. Memory model

The system has multiple memory layers:

```text
L0 Conversation Context
L1 Runtime Context Pack
L2 Canonical Vault
L3 Explicit Agent Policies
L4 Transaction / Working State
```

Only L2 and L3 are durable.

Rule:

> If a correction matters later, convert it into an explicit Vault fact or policy.

---


# 19. Privacy and prompt-injection policy

## 19.1. Privacy sequence

```text
candidate retrieval
↓
agent_access filter
↓
sensitivity filter
↓
model selection
↓
context assembly
↓
LLM
```

Never retrieve all content first and rely on prompt instructions after exposure.

## 19.2. External content is untrusted

Content from:

- web pages;
- PDFs;
- email;
- meeting transcripts;
- pasted text;
- imported files

can never override:

```text
system schema
agent policy
permissions
workflow
```

Instructions inside Sources are treated as data.

---


# 20. Agent-owned vs human-owned content

Human-owned by default.

Agent may autonomously edit only explicit dynamic sections:

```markdown
<!-- BEGIN AUTO:active-projects -->

...

<!-- END AUTO:active-projects -->
```

No marker → human-owned.

Mutation rule:

> Prefer the smallest possible structured patch over regeneration of a full file.

---

# 18. Model-context privacy routing

Context assembly is provider-aware only after access policy is resolved.

```text
candidate entities
→ agent_access/sensitivity filter
→ minimum-necessary Context Pack
→ allowed model profile/providers
→ Model Gateway or external-host response path
```

Rules:

- `local_only` context may be used only by approved local inference backends;
- `denied` content is excluded before any model request;
- no silent cloud fallback from a local/private route;
- external-host MCP requests receive only context permitted for that host/session;
- context manifests/provenance survive provider substitution so the user can inspect what was used.


## Identity/reference contract

Context Packs refer to managed entities by stable IDs, not filenames. Unmanaged-note pointers use path/hash identity until explicit adoption. See `20_VAULT_IO_AND_SCHEMA`.

---

<!-- SOURCE: 08_SAFETY__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Safety, Privacy & Security



## 1. Safety/security model

Ideomy safety focuses on preserving user agency, privacy, canonical history and recoverability.

Critical controls live in infrastructure/policy, not prompt text alone.

## 2. Core invariants

1. AI does not receive unrestricted filesystem/shell/SQL/arbitrary-network capabilities by default.
2. External/retrieved content is untrusted instructions.
3. `agent_access` is enforced **before** context reaches a model.
4. `denied` content is not read by the agent; `local_only` never leaves local model/tool boundary.
5. Whole-file rewrites are avoided; semantic patches are preferred.
6. Accepted Decisions and historical Journal are not retrospectively rewritten by automation.
7. Canonical deletes/merges require explicit user approval.
8. Significant Personal Vault write batches are diffable and rollbackable through the Core transaction layer; Git checkpoints are optional.
9. Secrets/API keys/private keys do not live in the Vault.
10. Prompt/model confidence never overrides mutation risk.

## 3. Risk × confidence

Confidence is transactional and field-specific. Execution policy depends on both model confidence and cost of a mistake.

Low-risk normalization may be automatic; high-impact merge/delete/accepted-decision mutation requires approval regardless of confidence.

## 4. Prompt injection

Web pages, PDFs, emails, chats, documents, retrieved notes and tool output are data. Instructions contained in them cannot alter Agent policy or authorize actions.

## 5. Privacy sequence

```text
request
→ identify candidate scope
→ enforce sensitivity/agent_access
→ minimize context
→ route to eligible model/tool
→ execute bounded operation
```

Never retrieve everything and rely on a prompt to hide sensitive context afterward.

## 6. Canonical safety sections

# 13. Agent permission model

## 13.1. Action levels

```text
L0 Read
L1 Analyze
L2 Suggest
L3 Auto + Log
L4 Autonomous
L5 Forbidden
```

## 13.2. Typical L4

- validate metadata;
- normalize topic spelling;
- update agent-owned dynamic sections;
- detect broken links;
- rebuild indexes;
- calculate system health.

## 13.3. Typical L3

- classify high-confidence Inbox item;
- add obvious relationship;
- extract straightforward metadata;
- move processed Source;
- rename malformed attachment.

## 13.4. Typical L2

- create Evergreen Knowledge;
- create Goal;
- merge notes;
- change Primary Area;
- close major Project;
- change Area health;
- supersede Decision.

## 13.5. L5

- rewrite historical Journal;
- rewrite accepted Decision rationale;
- delete canonical Knowledge automatically;
- leak restricted/local-only data;
- store secrets.

---


# 14. Risk model

Automation decision is based on:

```text
Confidence × Cost of mistake
```

Example:

| Operation | Confidence | Risk | Default |
|---|---:|---:|---|
| Add topic | high | low | auto |
| Add obvious Project link | high | low | auto + log |
| Change Primary Area | high | medium | suggest/log |
| Merge Knowledge | very high | high | approval |
| Delete verified Record | certain | high | forbidden by default |

---


# 19. Privacy and prompt-injection policy

## 19.1. Privacy sequence

```text
candidate retrieval
↓
agent_access filter
↓
sensitivity filter
↓
model selection
↓
context assembly
↓
LLM
```

Never retrieve all content first and rely on prompt instructions after exposure.

## 19.2. External content is untrusted

Content from:

- web pages;
- PDFs;
- email;
- meeting transcripts;
- pasted text;
- imported files

can never override:

```text
system schema
agent policy
permissions
workflow
```

Instructions inside Sources are treated as data.

---


# 20. Agent-owned vs human-owned content

Human-owned by default.

Agent may autonomously edit only explicit dynamic sections:

```markdown
<!-- BEGIN AUTO:active-projects -->

...

<!-- END AUTO:active-projects -->
```

No marker → human-owned.

Mutation rule:

> Prefer the smallest possible structured patch over regeneration of a full file.

---


# 21. Transaction model

Any write operation:

```text
Prepare
↓
Check permissions
↓
Read current hash
↓
Git snapshot
↓
Prepare typed mutations
↓
Dry validation
↓
Apply atomically
↓
Parse again
↓
Schema validation
↓
Link validation
↓
Diff
↓
Commit transaction / optional Git checkpoint / Review
```

Concurrent modification:

```text
hash changed since read
→ conflict
→ re-read
→ rebase patch or Review Queue
```

---


# 48. Security checklist

Before AI write access:

- [ ] Production Personal Vault is physically outside `ideomy`.
- [ ] Personal Vault is not a Git submodule or repository dependency of `ideomy`.
- [ ] Core build/tests/evals pass with no real Personal Vault available.
- [ ] All committed test/eval Vault data is synthetic or explicitly sanitized.
- [ ] Real Vault access requires an explicit configured path; no repo-relative implicit discovery.
- [ ] Independent Personal Vault backup exists.
- [ ] API secrets live outside Vault.
- [ ] Service binds to localhost only.
- [ ] `agent_access` enforcement works.
- [ ] Sensitive content can be excluded before LLM call.
- [ ] Typed mutation API exists.
- [ ] Full-file rewrite is not the default.
- [ ] Optimistic concurrency/hash checks exist.
- [ ] Atomic writes and transaction snapshots/journal exist.
- [ ] Historical Journal protection exists.
- [ ] Accepted Decision protection exists.
- [ ] Rollback is tested without requiring Git.
- [ ] Optional Vault Git adapter, if enabled, is private and non-authoritative.
- [ ] Prompt-injection eval exists.

---

---


# 17. Delivery / Bootstrap Security

- Bootstrap CLI may modify only the explicitly selected Vault and Ideomy-owned application directories.
- Any plugin installation/enabling action must be visible to the user; Ideomy must not disguise third-party-code enablement.
- Public bootstrap must use supported Obsidian CLI/plugin installation paths where available rather than silently editing Obsidian plugin registries as the default path.
- Core binaries/updates must be signed or otherwise integrity-verifiable before public distribution.
- Bootstrap/update logic never copies Personal Vault contents into telemetry, crash reports, package caches, update payloads or CI artifacts.
- A missing/disabled Obsidian CLI must fail clearly before plugin-side mutations and provide explicit enablement instructions; Core runtime correctness remains independent of Obsidian CLI after setup.
- Provider credentials are stored in OS-appropriate secret storage, not Vault Markdown.
- Existing Vault bootstrap defaults to non-destructive additive changes; destructive migrations require preview/approval/rollback.
- Uninstalling Ideomy must not delete the user's Personal Vault by default.


## Bootstrap/install safety

Bootstrap is a privileged local operation and must follow these controls:

- never use `curl | sh` as the canonical public installation path;
- Core binaries/packages must be versioned and integrity-verifiable before execution;
- setup may write only to explicit installation/config paths and the user-selected Vault;
- an existing Vault is additive/non-destructive by default;
- setup/update/uninstall never delete the Personal Vault as an implicit side effect;
- partial failure must leave canonical Markdown readable and recoverable;
- resumable setup must detect completed steps rather than blindly repeating destructive work;
- credentials collected during provider setup go to OS/env secret storage, never Vault Markdown or setup logs.

# 17. Model/provider safety

Model routing is a security boundary, not a prompt preference.

Hard rules:

- privacy policy executes before provider selection;
- `local_only` never falls back to cloud even on local model failure;
- `denied` never enters model context;
- API keys/tokens are stored outside the Vault (OS keychain/secure secret store/env for development);
- provider credentials are never written to canonical Markdown, model prompts, telemetry or transaction diffs;
- provider fallback is allowed only within the user's configured privacy/cost policy;
- switching to a provider with materially different data handling requires explicit configuration, not hidden retry logic;
- untrusted tool/source content cannot alter provider routing or reveal secrets.

External-host mode (ChatGPT/Claude via MCP) is separately permissioned because the host, not Ideomy Core, performs inference.


# Plugin safety boundary

- Plugin never calls cloud model providers directly; all provider routing is Core/Model Gateway owned.
- Sensitive Core operations require authenticated local transport; localhost alone is not an authorization mechanism.
- Plugin sends path/entity pointers instead of note bodies when Core can read canonical content itself.
- Provider/API secrets are not stored in Plugin data or Vault Markdown.
- Offline Plugin writes are limited to append/create-only Inbox Capture; ordinary canonical mutation still requires Core typed transactions.
- Review approval is bound to the reviewed version/patch; stale proposals cannot be silently applied.
- Community Plugin contains no client-side telemetry.

Full contract: `19_OBSIDIAN_PLUGIN`.


## Readiness security references

Path/symlink/write safety is canonical in `20_VAULT_IO_AND_SCHEMA`; local Core session/Vault binding is canonical in `21_CORE_PROTOCOL`; platform credential/distribution baseline is in `22_ENGINEERING_FOUNDATION`.

## Web capture trust boundary

All captured web text, metadata, highlights and any Web Clipper Interpreter output are untrusted external content.

Rules:

- captured instructions never override Ideomy policies or system prompts;
- a clipped page cannot grant tools/permissions;
- URL/content are validated before network follow-up;
- capture processing obeys the same `agent_access`/privacy routing as other Sources;
- capture files never contain provider credentials or Core transport secrets.

---

<!-- SOURCE: 09_CONNECTORS__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Connectors & Integration Boundaries



## 1. Integration philosophy

External systems remain authoritative for their own operational domain. Ideomy stores semantic context/references unless explicitly importing canonical content.

```text
Calendar     → schedule/reminders authority
Task manager → operational tasks authority
Drive        → external document/file authority
Ideomy Core transaction layer → Personal Vault mutation safety/rollback
Git          → `ideomy` source history; optional private Vault history
Obsidian     → primary human knowledge interface
Ideomy Vault → canonical personal knowledge/context authority
```

Avoid bidirectional “sync everything with everything”. Integrations must have explicit direction, ownership, conflict and deletion semantics.

## 2. Obsidian boundary

Filesystem/Markdown is the data plane. Obsidian CLI/plugin are application/UI control planes. Core must not require a custom plugin to read canonical knowledge.

## 3. Transaction and Git boundary

Ideomy Core transaction primitives are authoritative for Personal Vault mutation safety/rollback. Production Vault Git is optional and user-controlled.

Git is mandatory only for `ideomy` software/spec/eval history. Obsidian Git is optional human UI when the user separately enables private Git for the Personal Vault.

## 4. MCP boundary

MCP exposes **high-level semantic tools**, not raw filesystem/shell by default.

Initial read-first tools:

```text
ideomy.search
ideomy.get_entity
ideomy.get_context
ideomy.system_health
```

Controlled writes later:

```text
ideomy.capture
ideomy.propose_change
ideomy.process_inbox
ideomy.approve
```

## 5. Local API

Bind local service to loopback by default. Future plugin/web UI communicates with Ideomy Core through narrow localhost HTTP/WebSocket endpoints. No default LAN/public binding.

## 6. External connector contract

Any connector must define:

- source system and authority;
- read/write direction;
- canonical vs referenced data;
- stable external IDs/provenance;
- permissions;
- idempotency;
- deletion/disconnect semantics;
- privacy class;
- conflict handling;
- tests/evals.

## 7. Canonical connector/integration sections

# 22. Obsidian Implementation Stack

## 22.1. Native P0

- Properties
- Bases
- Templates
- Daily Notes
- Search
- Links / Backlinks
- Bookmarks
- Obsidian CLI

## 22.2. Community plugins

### P1

- QuickAdd — optional fast desktop capture.

### P2 / only if real need emerges

- Obsidian Git — only when the user explicitly enables private Vault Git;
- Dataview;
- Templater;
- Tasks.

No critical semantics may depend on these P2 plugins.

## 22.3. Role split

```text
Markdown/YAML
= canonical data

Bases
= native structured views

Obsidian CLI
= application control bridge

Ideomy transaction layer
= Personal Vault mutation safety + rollback

Git CLI
= `ideomy` source control + optional Vault checkpoint adapter

Obsidian Git
= optional human UI for user-enabled private Vault Git

Local Service
= intelligence + machine operations

MCP
= external agent interface
```

---


# 29. MCP Interface v1

Initial read tools:

```text
ideomy.search
ideomy.get_entity
ideomy.get_context
ideomy.system_health
```

Initial write workflows:

```text
ideomy.capture
ideomy.process_inbox
ideomy.propose_change
ideomy.get_review_queue
ideomy.approve
ideomy.reject
ideomy.rollback
```

High-level tools are preferred to raw filesystem primitives.

---


# 30. Local API v1

The optional Obsidian plugin can communicate with the service over localhost.

Minimal endpoints:

```text
GET  /health
POST /search
GET  /entities/:id
POST /agent/run

GET  /review-queue
POST /review/:id/approve
POST /review/:id/reject

GET  /system-health
GET  /transactions/:id
POST /transactions/:id/rollback
```

The endpoint design is implementation detail; MCP remains the primary external-agent interface.

---


# 31. Obsidian Plugin — phased native product surface

The Plugin is intentionally thin and phased:

```text
Bootstrap Plugin (M0)
= load + status + Core handshake + Vault identity + minimal Ideomy View

Product Plugin
= Ask + Capture + Context + Review Queue + Diff/Approval + Inspector + System Health
```

The Plugin must not become canonical storage, indexing, orchestration, model or transaction engine. Full contract: `19 OBSIDIAN_PLUGIN`.

---


# 47. Backup / Sync strategy

Recommended separation:

```text
Sync
≠
Version control
≠
Backup
```

Suggested roles:

```text
Obsidian Sync (optional)
→ device synchronization

Ideomy transaction journal/snapshots
→ safe machine writes + rollback

Private Vault Git (optional)
→ additional user-controlled history

ideomy monorepo Git
→ software/source history

Independent backup
→ disaster recovery
```

Do not treat Core Git or optional Vault Git as the only backup.

---


# 14. Obsidian Bootstrap / CLI Boundary

Obsidian CLI is the supported application-control bridge used by the canonical terminal bootstrap for plugin installation/enabling, command invocation, opening the selected Vault and diagnostics. It is not the canonical data access layer.

For fully automated public bootstrap, the setup command detects whether Obsidian CLI is available/enabled. If it is unavailable, bootstrap stops before plugin registry mutation and provides explicit enablement/manual instructions rather than silently editing unsupported internals. After installation, Core parser/index/retrieval contracts do not depend on Obsidian CLI or an active Obsidian window.

# 18. Model providers vs external AI hosts

Ideomy distinguishes two integration categories.

## 18.1. Direct Model Provider

Ideomy Core sends a model request through Model Gateway.

Initial adapter families:

```text
OpenAI provider
Anthropic provider
Gemini provider
OpenAI-compatible provider
optional Anthropic-compatible provider
```

OpenAI-compatible is intentionally broad enough for local/runtime products such as LM Studio and Ollama where capability conformance is verified.

## 18.2. External AI Host

The external product owns inference and invokes Ideomy via MCP/app mechanisms:

```text
ChatGPT / Claude / Codex / future host
→ Ideomy MCP
→ semantic tools/context
```

Host subscription usage is not normalized into a fake Ideomy API provider. Host plan capabilities are volatile and must be capability-discovered/documented rather than encoded as permanent ontology rules.


# Ideomy Plugin ↔ Core local protocol

The Obsidian Plugin consumes a versioned `CoreClient` semantic contract over local transport (initially loopback HTTP may be used; local IPC remains replaceable).

Required semantic operations cover handshake/health, search/context, Ask, capture/process, Review Queue, transaction diff, operation progress/cancel and model-profile status.

The Plugin does not expose raw filesystem/network primitives and does not bypass Core permission/mutation policy.

Full Plugin protocol contract: `19_OBSIDIAN_PLUGIN`.


## Core protocol reference

Plugin/CLI local communication and auth are canonical in `21_CORE_PROTOCOL`; connectors/integrations must not invent parallel local transport or bypass Core policy.

# Web Capture V1

## Decision

The **official Obsidian Web Clipper** is the canonical browser capture frontend for Ideomy V1. Ideomy does not build a custom Chrome/Firefox extension merely to duplicate page clipping.

Supported browser capture artifact:

```text
Obsidian Web Clipper
→ `01 Inbox/Web`
→ capture envelope `ideomy_capture: web-v1`
→ Core watcher/ingestion
```

Normative artifacts:

```text
web-clipper/templates/*.json
contracts/capture/web-capture-v1.schema.json
fixtures/test-vault/01 Inbox/Web/
evals/golden/web_capture.jsonl
```

## Capture vs Entity boundary

A Web Clipper note is initially a **capture artifact**, not a managed `source` Entity. Therefore Web Clipper does not generate Ideomy ULIDs, choose `primary_area`, resolve Projects, create Knowledge or mutate canonical relationships.

Core owns:

```text
provenance normalization
canonical URL normalization
duplicate/source resolution
classification
Source adoption/creation
Knowledge extraction/synthesis
Area/Project/linking
Review Queue decisions
```

This preserves the rule `capture first → classify/process later`.

## AI Interpreter boundary

The Ideomy template pack does not require Web Clipper Interpreter/prompt variables. Extraction is deterministic by default. If a user independently enables Interpreter, its generated text is treated as **untrusted capture content**, not canonical classification or Agent policy.

Ideomy Model Gateway remains the canonical semantic inference layer because it enforces privacy routing, provider policy, typed outputs and evals.

## Future Ideomy browser extension

A custom extension is evidence-triggered, not V1 infrastructure. It becomes justified only when the product requires browser-native bidirectional Ideomy capabilities such as:

```text
Already captured / duplicate status before save
Related Ideomy Knowledge while reading
Ask Ideomy about current page/selection
Add to current Project
Create Decision/Knowledge candidate
Core/System status in browser
```

If built later, it converges on the same Core Capture Pipeline and never invalidates the Web Clipper route.

---

<!-- SOURCE: 10_UX__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Product UX & Interaction Model



## 1. Product UX principle

The user should experience a simple system even when the backend ontology is sophisticated.

Normal daily surfaces:

```text
Home
Inbox / Capture
Current Project
Knowledge
Review Queue
Ask
```

The user should not need to think about 15 entity types, graph indexes or schema validation during routine work.

## 2. Home

Home answers four questions:

1. What matters now?
2. What am I working on?
3. What requires attention?
4. Where do I go next?

Home shows summaries/exceptions; full dashboards show exhaustive views.

## 3. Review Queue

Batch-oriented approval is preferred over constant modal interruptions. Show structural diffs for ambiguous/high-impact changes.

Typical groups:

- classification;
- knowledge candidates;
- merge candidates;
- Area health;
- project completion/state;
- conflicts.

## 4. AI interaction

AI is a capability, not a companion persona. Primary modes:

```text
Ask
Do
Review
```

Prefer contextual commands/surfaces over a giant chat-first product.

## 5. Trust UX

Show actual operations when useful:

- searching related entities;
- building context;
- resolving entities;
- validating changes;
- diff/rollback availability.

Do not use “AI magic” language when a deterministic operation can be named.

## 6. Canonical UX sections

# 11. Home and dashboard UX

The daily user should see complexity through a narrow interface:

```text
Home
Inbox
Current Project
Daily Note
Review Queue
```

Not:

```text
15 Entity Types
17 Areas
7 Domains
dozens of schema rules
```

## 11.1. Home answers four questions

1. Что важно сейчас?
2. Над чем я работаю?
3. Что требует внимания?
4. Куда перейти дальше?

Suggested sections:

```text
NOW
DIRECTION
PROJECTS
KNOWLEDGE
PEOPLE
REVIEW
```

---


# 15. Review Queue

Review Queue is a **dynamic view**, not a new Entity Type.

Categories:

```text
Classification
Knowledge candidates
Merge candidates
Area health
Project completion
Conflicts
Permission-sensitive changes
```

Target UX:

```text
Safe changes        17
Needs decision       4
Conflicts            2

[Approve safe]
```

Approval is batch-oriented, not interrupt-driven.

---


# 31. Obsidian Plugin — phased native product surface

The Plugin is intentionally thin and has two scopes.

### Bootstrap Plugin

```text
load
Core status / handshake
version compatibility
minimal Ideomy View
```

### Product Plugin

```text
Ask
Capture
Current Context
Review Queue
Diff / Approve / Reject
Entity Inspector / Relations
Project Context
Weekly Review
System Health
Settings / diagnostics
```

Default desktop placement is a single dockable Ideomy View in the right sidebar. Commands/context actions deep-link into modes rather than creating permanent UI panels for every capability.

Plugin must remain removable without data loss and must not become canonical storage/orchestration/model runtime. Mobile V1 supports lightweight/degraded surfaces and offline append-only Capture when desktop Core is unavailable.

Full interaction and technical contract: `19_OBSIDIAN_PLUGIN`.

---


# 43. System Health

## 43.1. Integrity

```text
invalid schemas
duplicate IDs
broken links
unknown enum values
```

## 43.2. Flow

```text
Inbox backlog
Source backlog
Review Queue
stale Projects
```

## 43.3. Knowledge quality

```text
old seeds
orphan Knowledge
duplicate candidates
contradiction candidates
```

## 43.4. Safety

```text
failed transactions
rollbacks
permission denials
unexpected agent writes
```

Health states:

```text
Healthy
Attention
Degraded
```

Do not invent fake `73/100` precision.

---


# 44. Setup & Onboarding UX

## 44.1. Primary onboarding path

```text
Run `ideomy setup` (or equivalent package-manager bootstrap)
→ Detect Obsidian / Obsidian CLI
→ Start fresh / Use existing Vault
→ Preview changes
→ Configure AI/privacy mode
→ Install/enable Plugin + install/configure Core
→ Bootstrap + initial index
→ First useful result
→ Open in Obsidian
```

Target time-to-first-value: **≤ 5 minutes** for a normal desktop install.

## 44.2. Existing Vault UX

Before any change, show exactly what Ideomy plans to add/change. Existing notes are not moved by default. Canonical Ideomy folders are optional/progressive for existing Vaults.

First-value examples:

- recurring topics detected;
- active project contexts inferred/proposed;
- unresolved decisions or review candidates surfaced;
- search/context works across existing notes.

## 44.3. New Vault UX

`Create Ideomy Vault` can install the canonical folder structure, Templates, Bases, system notes and plugin configuration.

## 44.4. Terminal bootstrap UX

V1 does not require a separate native installer/Companion application. The bootstrap CLI must provide a guided, human-readable setup experience rather than raw package-management steps.

Required setup capabilities:

```text
Obsidian / CLI detection
Vault create / attach
planned-change preview
Plugin install / enable
Core install / configure
provider/privacy configuration
initial index
status / doctor
open in Obsidian
```

If Obsidian CLI needs one-time enablement, show precise instructions and allow the user to resume the same setup flow after enabling it. Knowledge work remains in Obsidian/Ideomy surfaces.

## 44.5. Mobile

V1 mobile priority:

```text
capture
read
search
basic plugin surfaces
```

Heavy synthesis/index maintenance remains desktop/Core-first until mobile demand justifies native Core capability.

# 32. AI & Models UX

Bootstrap success does not require AI configuration. After Ideomy is healthy, onboarding may offer:

```text
AI setup

○ Configure later
○ Cloud API
○ Local AI
○ Hybrid
```

Settings surface concept:

```text
AI & Models

Ideomy Agent
Mode             Hybrid
Fast             Local / auto
Reasoning        Cloud / auto
Embeddings       Local / auto
Sensitive        Local only

External AI
ChatGPT          Connected / Not connected
Claude           Connected / Not connected
Other MCP host   …
```

The UI should expose profiles/capabilities and privacy consequences, not force users to understand provider internals. External-host connections are presented separately from Ideomy-native model providers.


# 45. Plugin UX contract reference

`19 OBSIDIAN_PLUGIN` is authoritative for Command Palette/ribbon/view behavior, Ask/Capture/Review/Diff interaction, Settings, Core-offline states, mobile reduced capability, accessibility/theme integration and Plugin performance/security gates.


## Implementation readiness reference

UI references managed entity IDs/logical properties and Core semantic operations. Physical Vault keys/transport endpoints are not UI concepts. See `20` and `21`.

## Browser capture UX

V1 browser capture UX intentionally inherits the official Obsidian Web Clipper interaction model. Ideomy contributes templates and downstream intelligence rather than another browser toolbar UX.

User promise:

```text
one clip
→ appears in 01 Inbox/Web
→ preserved provenance/content
→ later Ideomy processing without mandatory classification questions at capture time
```

Browser capture must remain fast and low-friction. Area, Project, Topic and Knowledge decisions occur later in Ideomy/Core or Review Queue.

---

<!-- SOURCE: 11_IMPLEMENTATION__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Implementation Blueprint & Roadmap


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
ideomy setup
→ plugin enabled
→ Core paired
→ doctor Healthy
```

No LLM required.

## 9. M0.5 — Bootstrap hardening

Add:

```text
idempotent setup/resume
existing-Vault non-destructive flow
repair/update/uninstall foundations
macOS Core lifecycle adapter
interruption tests
support diagnostics
```

M0 is complete only after clean-machine and interrupted-install acceptance tests pass.

## 10. M1 — Structured index / FTS

Implement SQLite schema/migrations per `22_ENGINEERING_FOUNDATION` and Vault contracts:

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

---

<!-- SOURCE: 12_EVALS__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Evaluation & Quality Gates


## 1. Purpose

Ideomy uses executable regression gates, not demo-based confidence. The golden corpus lives in the software repo and contains only synthetic/pseudonymous data.

## 2. M0/M1 deterministic suites

### Schema/Vault I/O

```text
all managed fixture notes validate when expected
invalid type/status/ID cases fail with stable diagnostics
unknown user properties preserved
frontmatter comments/key order preserved within contract
body bytes unchanged outside targeted mutation/AUTO section
malformed YAML is never silently repaired/written
path traversal/symlink escape rejected
```

Hard gates:

```text
schema validity of valid fixtures        = 100%
expected-invalid detection               = 100%
canonical body unintended diff           = 0
critical path traversal escape           = 0
```

### Protocol

```text
handshake compatibility
pairing/session auth
Vault fingerprint mismatch
expired/revoked session
idempotency replay
operation event order
error-envelope schema
reconnect after Core restart
```

Hard gates: critical auth/Vault-isolation failures = 0.

### Transactions

```text
concurrent external edit conflict
process crash between prepare/apply/validate
single-file rollback
multi-file recovery
invalid post-write schema
own-watcher event suppression
```

Hard gate: failed transaction must leave or recover to a valid canonical Vault in golden crash cases.

## 3. Retrieval suites

Golden queries cover:

- exact ID/title/alias;
- accepted Decision recall for “why?”;
- Project Context Pack;
- Area-scoped retrieval;
- unmanaged note retrieval;
- Journal/Inbox down-ranking where appropriate;
- Russian/English lexical variants.

Initial targets before AI Ask promotion:

```text
exact entity lookup accuracy      = 100%
Decision why-query Recall@5       >= 0.95
Project Context key-item Recall@10 >= 0.90
critical wrong-Vault retrieval    = 0
```

## 4. Classification / entity resolution

Initial golden corpus target before auto-classification:

```text
>= 60 classification cases
>= 30 entity-resolution/duplicate cases
```

Initial promotion thresholds:

```text
managed-output schema validity    >= 0.99
primary_area accuracy             >= 0.92
entity-resolution precision       >= 0.98
false automatic merge             = 0
privacy/policy violation          = 0
```

Below-threshold/ambiguous output stays proposal/review-only.

## 5. Knowledge creation

Track:

```text
new-note precision
update-existing precision
false duplicate creation
source/provenance preservation
contradiction handling
```

No production auto-create threshold is enabled until a golden corpus exists and an ADR accepts it.

## 6. Privacy / injection

Required adversarial cases include:

```text
denied note never exposed
local_only never cloud-routed
malicious Markdown/PDF instruction ignored as instruction
malicious MCP/tool text cannot change policy
secrets absent from prompts/logs/diffs
localhost unauthenticated sensitive request rejected
wrong Vault fingerprint rejected
```

Critical failure budget = 0.

## 7. Plugin suites

From `19_OBSIDIAN_PLUGIN`:

```text
startup_load
lifecycle_cleanup
bootstrap_handshake
protocol_compatibility
core_offline_degraded
capture_offline_append_only
active_context_scoping
ask_provenance
review_stale_conflict
approval_version_binding
mobile_no_node_imports
settings_secret_redaction
```

## 8. CLI/bootstrap suites

```text
fresh new Vault
existing Vault
rerun successful setup
resume each failure boundary
non-interactive parity
--json schema
exit/diagnostic codes
Core/Plugin mismatch
uninstall preserves Vault
```

## 9. Model Gateway suites

Each provider/profile is approved per capability, not globally.

Track:

```text
structured-output validity
tool/capability conformance
latency
cost/usage
fallback correctness
local_only enforcement
provider unavailable/rate limited
```

## 10. Golden artifacts

Canonical committed inputs:

```text
fixtures/test-vault/
contracts/examples/
schemas/
evals/thresholds.json
evals/golden/*.jsonl
```

The v0.9 Pack ships the initial synthetic corpus (60 classification + 30 entity-resolution cases plus retrieval/security/mutation seeds). Implementation extends it; it does not recreate the first corpus from prose.

Real Personal Vault content is prohibited from committed eval artifacts.

## 11. Release gate policy

A PR cannot weaken an accepted hard gate without ADR. Soft quality thresholds may change with evidence but must be versioned and reported.

A model/provider/schema/protocol version change is a release-relevant event when it can change outputs or compatibility.

## 12. System Health operational defaults

These are user-system thresholds, not model-quality gates:

```text
Inbox 0–20 healthy; 21–50 attention
active Project stale >14 days
Knowledge seed stale >30 days
Source unprocessed >21 days
broken canonical links target 0
```

They are adjusted only from usage evidence.

## Web Capture evals

`evals/golden/web_capture.jsonl` validates the V1 browser-capture boundary:

- capture envelope is recognized but remains unmanaged until Core adoption;
- Web Clipper never allocates managed Entity identity;
- duplicate URLs route to dedup/source-resolution logic;
- prompt-injection text remains untrusted content;
- capture works without Web Clipper Interpreter;
- selection/highlight modes preserve provenance.

Hard gates from `evals/thresholds.json`:

```text
web_capture_contract_validity = 1.00
web_capture_policy_override_failures = 0
```

---

<!-- SOURCE: 13_ADR__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# Architecture Decision Record Index



## Status

All decisions below are current for Ideomy specification pack v0.3.0 unless explicitly marked Superseded. Changes create a superseding ADR/decision; history is not rewritten silently.

## Decisions

### ADR-001

**Accepted:** Ideomy is the master brand; components use descriptive names only.

### ADR-002

**Accepted:** Ideomy category is Personal Knowledge OS; legacy PKM category labels are explanatory only, not canonical naming.

### ADR-003

**Accepted:** Markdown Vault is the canonical knowledge store.

### ADR-004

**Accepted:** Derived SQLite/FTS/vector/graph indexes are rebuildable caches, never source of truth.

### ADR-005

**Accepted:** Vault uses entity-first shallow physical folders.

### ADR-006

**Accepted:** Semantic classification lives in typed Properties/relationships, not folder taxonomy.

### ADR-007

**Accepted:** Seven Domains and seventeen Areas define Life Ontology v1.

### ADR-008

**Accepted:** Information Ontology uses typed first-class entities; Topic/Task/Idea/Document are not separate default entity types.

### ADR-009

**Accepted:** Every processed entity has at most one primary Area and at most two related Areas.

### ADR-010

**Accepted:** Primary Area is determined by intent, not keyword presence.

### ADR-011

**Accepted:** Source and Knowledge are separate entities.

### ADR-012

**Accepted:** New Knowledge has a high reusable/novel/standalone creation threshold.

### ADR-013

**Accepted:** Accepted Decisions are first-class historical records and are superseded rather than silently rewritten.

### ADR-014

**Accepted:** Journal is historical primary source; automation may extract from it but not rewrite history.

### ADR-015

**Accepted:** Human filenames are readable; entity IDs are stable/immutable.

### ADR-016

**Accepted:** Properties use canonical lowercase_snake_case vocabulary.

### ADR-017

**Accepted:** Complex nested YAML is avoided in core schema.

### ADR-018

**Accepted:** Native Obsidian Properties/Bases/Templates are preferred before community-plugin dependencies.

### ADR-019

**Accepted:** Dataview/Templater/Tasks are optional, not semantic foundations.

### ADR-020

**Superseded by ADR-055:** v0.1 used two primary repositories (`ideomy-vault` + `ideomy-core`). This is retained as architecture history only.

### ADR-021

**Accepted:** Ideomy Core is TypeScript-first for v1.

### ADR-022

**Accepted:** One orchestrator with composable skills is used; no multi-agent swarm in MVP.

### ADR-023

**Accepted:** Skill and Tool are separate abstractions.

### ADR-024

**Accepted:** Agent never gets unrestricted filesystem/shell/SQL/arbitrary-network tools by default.

### ADR-025

**Accepted:** Typed mutation API is preferred over full-document model rewrites.

### ADR-026

**Accepted:** Agent-owned AUTO sections are explicitly delimited; unmarked content is human-owned by default.

### ADR-027

**Superseded by ADR-056:** v0.1 required Git as the Personal Vault write-transaction safety/audit/rollback layer.

### ADR-028

**Accepted:** Bulk/high-risk changes support dry-run/diff before apply.

### ADR-029

**Accepted:** Optimistic concurrency/hash checks prevent overwriting concurrent human edits.

### ADR-030

**Accepted:** External/retrieved content is always untrusted as instructions.

### ADR-031

**Accepted:** Privacy/sensitivity enforcement occurs before model routing/context construction.

### ADR-032

**Accepted:** Secrets/API keys/private keys never live in the Vault.

### ADR-033

**Accepted:** Canonical deletes and merges require explicit approval.

### ADR-034

**Accepted:** Confidence never overrides mutation risk.

### ADR-035

**Accepted:** Context Packs are runtime constructs, not permanent entities.

### ADR-036

**Accepted:** If information matters later it is written explicitly to Vault/policy, not hidden model memory.

### ADR-037

**Accepted:** Explicit policies are preferred over opaque learned agent memory.

### ADR-038

**Accepted:** Retrieval is structured/lexical/graph-first; vector search is added only when a measured gap exists.

### ADR-039

**Accepted:** Journal and raw Inbox have lower default authority/retrieval priority than accepted Decisions/evergreen Knowledge.

### ADR-040

**Accepted:** Graph is derived from typed Properties + wikilinks; no Neo4j in MVP.

### ADR-041

**Accepted:** SQLite is the initial local structured/FTS index.

### ADR-042

**Accepted:** MCP is a semantic integration interface; initial exposure is read-first.

### ADR-043

**Accepted:** MCP does not expose raw filesystem/shell as primary tools.

### ADR-044

**Accepted:** Obsidian custom AI plugin is deferred until Core contracts are stable.

### ADR-045

**Accepted:** Ideomy must remain usable if Agent/Core/LLM is disabled.

### ADR-046

**Accepted:** Capture is frictionless; classification happens later.

### ADR-047

**Accepted:** Review Queue is batch-oriented rather than interrupt-driven.

### ADR-048

**Accepted:** Weekly Review is the primary human-in-the-loop maintenance cycle.

### ADR-049

**Accepted:** System Health is exception-driven: integrity, flow, knowledge quality and safety.

### ADR-050

**Accepted:** External systems remain authoritative for schedules/tasks/files unless explicitly imported.

### ADR-051

**Accepted:** Bidirectional sync is not the default integration strategy.

### ADR-052

**Accepted:** AI UX is capability-oriented (Ask/Do/Review), not an anthropomorphic companion.

### ADR-053

**Accepted:** No branded internal ontology engine; Core/Graph/Agent/Vault/CLI/MCP remain descriptive.

### ADR-054

**Accepted:** Architecture-level semantic changes require ADR + affected specs/evals updates.

### ADR-055

**Accepted, amended by ADR-121:** Ideomy MVP uses one mandatory software Git repository and one external Personal Vault. The production Personal Vault is not a child directory, Git submodule, fixture, CI input or build dependency of the software repository. The repository was called `ideomy-core` when this ADR was accepted; ADR-121 renames it to `ideomy` without changing this boundary.

### ADR-056

**Accepted, amended by ADR-121:** Personal Vault mutation safety is owned by the Ideomy Core transaction layer (typed mutations, optimistic concurrency, snapshots/journal, atomic writes, validation, diff and rollback). Git is mandatory for the canonical `ideomy` software monorepo and optional/user-controlled for the Personal Vault.

### ADR-057

**Accepted:** Automated development, tests, CI and evals use synthetic/pseudonymous `fixtures/test-vault` content and must succeed without access to any production Personal Vault.

### ADR-058

**Accepted:** A future `ideomy-vault-template` may be distributed as an optional separate artifact, but it is never the user's production Vault and is not required for MVP.

### ADR-059

**Superseded by ADR-069:** v0.3 accepted Setup/Companion + thin Obsidian Plugin + local Ideomy Core. The separate native Setup/Companion application is no longer part of the canonical V1 delivery path.

### ADR-060

**Superseded by ADR-069 and ADR-071:** v0.3 required Bootstrap CLI before a graphical Setup/Companion. CLI bootstrap remains, but the separate native graphical Setup/Companion is no longer part of V1.

### ADR-061

**Accepted:** Public V1 supports both `Create Ideomy Vault` and `Use existing Obsidian Vault`; existing Vault adoption does not require wholesale folder migration.

### ADR-062

**Accepted:** Ideomy Plugin is a thin in-context UX/client layer. Heavy indexing, retrieval, transactions, model routing, MCP and background agent work belong to Ideomy Core.

### ADR-063

**Superseded by ADR-072 and ADR-073:** v0.3 treated Obsidian CLI as optional/supported automation. V0.4 makes it the supported bridge for fully automated public plugin bootstrap while preserving runtime independence after installation.

### ADR-064

**Accepted:** V1 target median time-to-first-value is ≤ 5 minutes on supported desktop configurations.

### ADR-065

**Accepted:** Standalone Ideomy Desktop/editor is deferred until post-PMF evidence shows Obsidian is a material adoption/product constraint.

### ADR-066

**Accepted:** Web may support account/billing/docs/remote surfaces, but is not the canonical local-first knowledge runtime in V1.

### ADR-067

**Accepted:** Mobile V1 prioritizes capture/read/search/basic plugin UX; heavy Core parity is deferred until justified by usage.

### ADR-068

**Accepted:** Core, Plugin and optional Vault template may be separate distribution artifacts, but user-facing onboarding presents a single Ideomy product and does not require manual component assembly in V1.

### ADR-069

**Accepted:** Ideomy public V1 uses a terminal-first single-command bootstrap (`ideomy setup` or equivalent package-manager entry point) to install/configure the thin Obsidian Plugin, separate local Ideomy Core and external Personal Vault. Architecture remains modular; installation must feel like one product.

### ADR-070

**Accepted:** Ideomy Core remains a separate local runtime/process rather than being embedded wholesale into the Obsidian Plugin. Installation friction is solved by bootstrap automation, not by collapsing runtime boundaries.

### ADR-071

**Accepted:** A separate native Setup/Companion application is out of V1 scope. It may be reconsidered only if terminal onboarding data shows material adoption/support failure.

### ADR-072

**Accepted:** Obsidian CLI is the supported application-control bridge for fully automated plugin installation/enabling/opening during public bootstrap. Bootstrap detects CLI availability/enabled state and provides explicit resumable enablement instructions rather than silently mutating unsupported Obsidian internals.

### ADR-073

**Accepted:** Core runtime correctness, indexing, retrieval, transactions, MCP and background work remain independent of Obsidian CLI or a running Obsidian UI after installation.

### ADR-074

**Accepted:** The first installable Ideomy vertical slice is Bootstrap Foundation: `ideomy setup → Plugin + Core + external Vault → minimal parse/validate/index → ideomy doctor → Healthy`. AI/LLM capabilities are not required for this milestone.

### ADR-075

**Accepted:** `ideomy setup` is an idempotent, resumable state machine. Re-running setup after success or partial failure must detect existing state, resume/repair safely and must not create duplicate Vaults, Plugin installations or Core configuration.

### ADR-076

**Accepted:** `ideomy status` and `ideomy doctor` are first-class Bootstrap Foundation commands. `status` reports concise runtime state; `doctor` performs structured diagnostics across environment, Obsidian/CLI, Plugin, Core, Vault, schema and index layers.

### ADR-077

**Accepted:** Bootstrap implementation is TypeScript-first and reuses Ideomy Core contracts. Shell scripts may wrap distribution convenience but are not the canonical installation logic.

### ADR-078

**Accepted:** Setup/update/uninstall are Vault-preserving by default. Uninstall may remove Core, Plugin and Ideomy configuration, but deletion of the Personal Vault requires a distinct explicitly confirmed destructive operation.

### ADR-079

**Accepted:** Bootstrap must stop rather than directly mutate unsupported Obsidian internals when the supported Obsidian CLI/plugin installation path is unavailable. It provides exact resumable remediation instructions instead.

## Change policy

Architecture-level change requires:

1. problem/context;
2. affected ADR/invariants;
3. at least 2 viable options where meaningful;
4. trade-offs;
5. decision;
6. consequences/migration;
7. eval/security impact;
8. affected domain docs and `AGENTS.md` update.

Implementation convenience alone is not sufficient reason to silently violate an accepted decision.

### ADR-080

**Accepted:** Generative LLM integration begins only after Bootstrap Foundation and the deterministic knowledge substrate (parse/schema/index/retrieval/typed mutation safety) are stable enough to support reproducible Context Packs and writes.

### ADR-081

**Accepted:** Model Gateway is the sole direct model-provider boundary for Ideomy-native inference. Skills/Orchestrator do not call provider SDKs directly.

### ADR-082

**Accepted:** Ideomy distinguishes **Direct Model Provider** from **External AI Host**. Direct providers are called by Core; external hosts (e.g. ChatGPT/Claude) perform their own inference and call Ideomy through MCP/app interfaces.

### ADR-083

**Accepted:** Consumer AI subscriptions are not assumed to be reusable API entitlements. Subscription-host usage is supported through official host/MCP mechanisms; autonomous Ideomy-native inference requires a configured direct/local provider endpoint.

### ADR-084

**Accepted:** Local inference is a first-class Model Gateway route. Initial supported local integration family is OpenAI-compatible/local endpoints, with LM Studio and Ollama targeted for conformance testing rather than hard-coded model assumptions.

### ADR-085

**Accepted:** Privacy/sensitivity routing precedes model selection. `local_only` content cannot fall back to cloud; `denied` content is never model-visible.

### ADR-086

**Accepted:** Skills request model profiles/capabilities (`fast`, `balanced`, `reasoning`, `local-private`, `embedding`) rather than hard-coded provider/model names.

### ADR-087

**Accepted:** Model/provider credentials live outside the Personal Vault and are never included in prompts, canonical Markdown, ordinary telemetry or transaction diffs.

### ADR-088

**Accepted:** The first LLM-backed product capability is structured `classify`, followed by `connect`, `ask`, then deeper Source→Knowledge synthesis as eval quality matures.

### ADR-089

**Accepted:** Embedding generation is a separate capability from generative reasoning. Local and cloud embedding providers can be routed independently and vector retrieval remains optional until measured recall gaps justify it.

### ADR-090

**Accepted:** Provider/host model availability, plan entitlement and feature support are volatile operational capabilities, not ontology/domain invariants. Ideomy uses configuration/capability detection and conformance evals rather than hard-coded subscription assumptions.

### ADR-091

**Accepted:** AI/model configuration is optional during bootstrap. `ideomy setup`/`doctor` can reach a healthy deterministic Ideomy without any LLM provider, API key or local model.

### ADR-092

**Accepted:** Provider fallback is explicit policy. A retry/fallback may occur only within configured privacy, capability and cost constraints; Ideomy never silently widens data exposure to recover from a provider failure.

### ADR-093

**Accepted:** Ideomy CLI is a versioned public product/automation contract, not merely an internal bootstrap script. Public automation depends on documented JSON, exit-code and diagnostic-code contracts rather than parsing human output.

### ADR-094

**Accepted:** The primary user CLI surface remains small (`setup`, `status`, `doctor`, `update`); advanced administration is organized into `core`, `vault`, `index`, `config` and later `models` namespaces.

### ADR-095

**Accepted:** Core interactive workflows require an equivalent non-interactive path. `--non-interactive` never prompts; missing required choices fail deterministically.

### ADR-096

**Accepted:** Read/status/admin commands support versioned `--json` output where automation needs it. JSON stdout remains clean; progress/diagnostics cannot corrupt it.

### ADR-097

**Accepted:** CLI exit codes use stable broad semantic classes while stable diagnostic-code families provide specific failure identity. Automation should prefer both rather than human copy.

### ADR-098

**Accepted:** `ideomy doctor` is read-only by default. State repair is explicit through `ideomy repair` and uses diagnose → plan → confirm → apply → validate semantics.

### ADR-099

**Accepted:** Configuration precedence is explicit: CLI option → supported environment variable → machine/user config → portable Vault config → built-in defaults. Secrets remain outside canonical Vault/plain config and are redacted from output/logs.

### ADR-100

**Accepted:** Platform-specific Core service/process behavior is hidden behind a lifecycle adapter. Public `core start/stop/restart/status/logs` semantics remain platform-independent.

### ADR-101

**Accepted:** Update performs compatibility/integrity preflight across CLI/Core/Plugin/schema contracts before activation and preserves the Personal Vault. Incompatible versions are not silently activated.

### ADR-102

**Accepted:** `ideomy uninstall` preserves the Personal Vault by default. A future Vault deletion capability, if added, is a separate explicitly destructive command rather than a hidden `--force` path.

### ADR-103

**Accepted:** Once public V1 CLI is released, removing/renaming commands/options, changing option meanings, exit-code class semantics or incompatible JSON schemas is a breaking interface change. Human-readable formatting is not a machine compatibility contract.

### ADR-104

**Accepted:** CLI is an installation/admin/automation surface, not a terminal knowledge editor or unrestricted shell/filesystem interface. Full-screen TUI, AI chat terminal and generic shell/SQL/fs commands are out of CLI Foundation scope.

### ADR-105

**Accepted:** CLI Model Gateway management (`models list/status/test/configure`) is introduced only in M2. Provider tests use synthetic/non-sensitive inputs and cannot override privacy routing or treat consumer AI-host subscriptions as direct API credentials.



### ADR-106

**Accepted:** Ideomy uses one Plugin product with phased scope: minimal Bootstrap Plugin is required in M0; richer Product Plugin surfaces are added after deterministic Core contracts stabilize.

### ADR-107

**Accepted:** Ideomy Plugin remains a thin Obsidian-native client. Indexing, retrieval, transaction engine, Agent orchestration, Model Gateway, MCP and background workloads remain Core responsibilities.

### ADR-108

**Accepted:** V1 Plugin targets `isDesktopOnly: false`; Plugin source/dependencies must not rely on Node.js/Electron APIs. Desktop-native capabilities live in separate Core.

### ADR-109

**Accepted:** The Plugin exposes one primary dockable Ideomy View (right-sidebar default on desktop) plus commands/context actions rather than many permanent custom views.

### ADR-110

**Accepted:** Public Plugin command IDs and Core protocol contracts are versioned compatibility surfaces; incompatible Plugin/Core mutation contracts fail visibly rather than “best-effort” execution.

### ADR-111

**Accepted:** Plugin/Core communication goes through a versioned semantic CoreClient contract. UI components do not issue ad-hoc raw Core requests.

### ADR-112

**Accepted:** Sensitive Plugin/Core operations require authenticated machine-local sessions and Vault identity validation. Loopback binding alone is not authorization.

### ADR-113

**Accepted:** Core-unavailable Plugin operation is an explicit degraded state. Plugin must still load and may support offline append/create-only Inbox Capture without granting general direct-write authority.

### ADR-114

**Accepted:** Review Queue is the canonical Plugin approval surface for ambiguous/high-impact semantic changes; approval binds to the reviewed version/patch and stale proposals are not silently applied.

### ADR-115

**Accepted:** Ask sessions are transient by default. AI conversation does not become canonical Knowledge/Memory without explicit user workflow.

### ADR-116

**Accepted:** Plugin settings contain only lightweight client/UI configuration. Provider secrets, canonical entity databases and full note caches do not live in Plugin/Vault settings.

### ADR-117

**Accepted:** Community Plugin contains no client-side telemetry. Any Core/server telemetry follows separate explicit privacy/disclosure policy.

### ADR-118

**Accepted:** Plugin startup performs registrations only; Vault scanning, indexing, migrations, model work and other heavy tasks are deferred to Core/after layout readiness.

### ADR-119

**Accepted:** Plugin distribution follows supported Obsidian Community directory lifecycle. Plugin does not self-install/update itself, Core or dependencies; Core lifecycle is owned by Ideomy CLI/bootstrap/update tooling.


# Implementation Readiness Decisions — v0.9.0

### ADR-120
**Accepted:** Current domain documents are normalized; superseded prose must live only in ADR/Changelog, not compete with current instructions.

### ADR-121
**Accepted:** Canonical software repository is `ideomy` monorepo; `ideomy-core` as repository name is superseded.

### ADR-122
**Accepted:** M0/M1 engineering baseline is Node.js 24 LTS + pnpm 12.x + TypeScript 7.x strict + Vitest 5.x + Zod 4.6.x + Biome 2.5.x.

### ADR-123
**Accepted:** M0/Alpha Core/bootstrap is macOS-first behind platform adapters; Windows/Linux follow before public desktop-support claim.

### ADR-124
**Accepted:** SQLite is behind `SqliteStore`; Alpha baseline uses `better-sqlite3` 13.x rather than current active-development `node:sqlite`.

### ADR-125
**Accepted:** Existing Vault notes remain unmanaged documents until explicitly adopted; managed Entities are marked by `ideomy_schema` + immutable ID + type.

### ADR-126
**Accepted:** Managed Entity IDs use type-prefix + immutable ULID and are independent of filename/title/path.

### ADR-127
**Accepted:** Ideomy defines logical property names and supports explicit physical-property mapping for existing Vault collisions.

### ADR-128
**Accepted:** Vault writes preserve body/unknown properties and use YAML node/document-aware surgical mutation; ordinary metadata changes never regenerate the full Markdown document.

### ADR-129
**Accepted:** Core protocol V1 uses loopback HTTP/JSON plus SSE behind a versioned `CoreClient`; port is discovered, not hard-coded.

### ADR-130
**Accepted:** Sensitive Plugin↔Core operations require paired authenticated sessions; localhost alone is not authorization. Plugin pairing uses local non-extractable client key where supported and no long-lived Vault-synced bearer secret.

### ADR-131
**Accepted:** Core protocol request/response/error/operation contracts are machine-readable and versioned under `contracts/protocol/v1`.

### ADR-132
**Accepted:** `vault-template/`, `fixtures/test-vault/` and `schemas/` are normative implementation artifacts and must evolve with prose specs.

### ADR-133
**Accepted:** Initial golden eval thresholds are explicit in `12_EVALS`; critical security/privacy/schema integrity failures have zero tolerance.

### ADR-134
**Accepted:** Multi-file Vault writes provide recoverable transaction atomicity via journal/snapshots, not a false claim of filesystem-wide atomic commit.

### ADR-135
**Accepted:** Public Beta packaging/signing mechanism is a later distribution ADR; M0 may require Node 24 for developers/Alpha, while user-facing V1 must not require a manual development toolchain.

# Web Capture Decisions — v0.10.0

### ADR-136
**Accepted:** Ideomy V1 uses the official Obsidian Web Clipper as its primary browser capture frontend; no custom Chrome/Firefox extension is required for clipping parity.

### ADR-137
**Accepted:** Browser clips are lightweight capture artifacts (`ideomy_capture: web-v1`) rather than managed Source entities. Core assigns managed identity and semantics only during adoption/processing.

### ADR-138
**Accepted:** Ideomy Web Clipper templates are deterministic by default and do not require Web Clipper Interpreter. Any independently generated Interpreter text is untrusted input; Model Gateway remains the canonical semantic inference layer.

### ADR-139
**Accepted:** A future Ideomy browser extension is evidence-triggered and must justify itself through Ideomy-aware bidirectional browser capabilities (Ask, related knowledge, project context, pre-save dedup), not basic clipping.

### ADR-140
**Accepted:** Official Web Clipper and any future Ideomy browser client converge on the same Core Capture Pipeline and canonical Source/Knowledge processing rules.

# Brand & Namespace Rename — v0.11.0

### ADR-141
**Accepted:** The canonical product name changes from **Ideome** to **Ideomy** before implementation begins. The technical namespace changes with it: repository `ideomy`, CLI `ideomy`, package scope `@ideomy/*`, Plugin/Core/MCP/tool/config/runtime/schema identifiers use `ideomy`, and protocol headers use `X-Ideomy-*`. The former `Ideome` / `ideome` names are historical only and require no runtime compatibility alias because no public implementation has shipped.

---

<!-- SOURCE: 14_AGENTS__created-06-10-26_16-40-00__updated-12-10-26_16-30-30__v0.11.0.md -->

# AGENTS — AI Coding Agent Instructions


## 0. Purpose

This file is mandatory for Codex/other coding agents working in the Ideomy software repository.

Implement the accepted specifications **without inventing foundational contracts that the Pack already defines**.

## 1. Read before work

Always read:

```text
00 README
13 ADR
22 ENGINEERING_FOUNDATION
```

Then read relevant docs:

```text
Vault/schema/parser/write → 03 + 20 + 12
Core/Plugin/CLI transport → 21 + 19/18
Bootstrap → 15 + 16 + 18 + 19 + 21
Models/Agent → 17 + 05 + 06 + 07 + 08 + 12
```

## 2. Priority of truth

```text
hard invariant in AGENTS
> accepted non-superseded ADR
> machine-readable schema/protocol artifact
> numbered domain specification
> existing code / convenience
```

If code conflicts with spec, do not preserve code merely because it exists. If machine contract and prose conflict, stop and repair the specification/ADR rather than choosing silently.

## 3. Critical invariants — NEVER violate

### INV-001
Personal production Vault is external to `ideomy` repo and is never fixture/CI/build input.

### INV-002
Canonical knowledge lives in Vault Markdown/attachments, not SQLite/vector/model memory.

### INV-003
Derived index/cache can be deleted/rebuilt without canonical knowledge loss.

### INV-004
Unmanaged existing notes are not silently adopted/rewritten as managed Entities.

### INV-005
Managed Entity IDs are immutable type-prefix + ULID and independent of path/title.

### INV-006
Duplicate managed IDs are hard integrity errors.

### INV-007
Unknown user properties and user-owned Markdown content are preserved by ordinary typed mutations.

### INV-008
No ordinary mutation uses whole-file/whole-Markdown regeneration when a targeted mutation can satisfy the contract.

### INV-009
Writes use optimistic precondition hash + transaction journal/snapshot + post-write validation; conflicting external edits are not overwritten silently.

### INV-010
Multi-file operations claim recoverability, not impossible filesystem-wide atomicity.

### INV-011
Plugin and CLI consume versioned CoreClient/contracts and do not import Core server internals.

### INV-012
Sensitive local Core operations require authenticated session + Vault identity; localhost is not authorization.

### INV-013
Plugin stores no provider secret or long-lived sensitive Core credential in Vault-synced data.

### INV-014
Plugin remains browser/mobile-safe (`isDesktopOnly: false` target) and imports no Node/Electron API.

### INV-015
Agent/skills receive semantic tools, never unrestricted SQL/shell/filesystem/network by default.

### INV-016
All Ideomy-native model calls go through Model Gateway; skills never call provider SDKs directly.

### INV-017
`local_only` content never cloud-fallbacks; `denied` content never enters model context.

### INV-018
External/source/tool content is untrusted data, never policy/instructions.

### INV-019
Secrets never enter Vault Markdown, ordinary config, logs, prompt dumps or fixtures.

### INV-020
`setup/status/doctor` and deterministic Vault/index operation remain useful without LLM/provider availability.

### INV-021
V1 browser capture uses official Obsidian Web Clipper + Ideomy templates. Do not build a custom browser extension or let Web Clipper create managed semantic entities unless a later ADR explicitly changes this.

## 4. Repository/package rules

Canonical repo: `ideomy`.

Follow `22_ENGINEERING_FOUNDATION` package boundaries. Do not create new top-level package/app without demonstrated need and architecture review.

Forbidden dependency edges include:

```text
obsidian-plugin → core server internals
core domain → Obsidian API
contracts → UI/platform/provider SDK
skill → provider SDK
```

## 5. Implementation style

- TypeScript strict;
- Zod/public typed contracts at boundaries;
- small composable modules;
- explicit state/error types;
- deterministic functions for parsing/schema/retrieval ranking where possible;
- no framework magic for simple local runtime;
- no broad agent framework in M0/M1;
- idempotent setup/jobs/writes where contract requires.

## 6. Vault rules

Before Vault code read `20_VAULT_IO_AND_SCHEMA`.

- parse raw bytes and preserve encoding/newlines contract;
- malformed/duplicate-key YAML blocks managed mutation;
- use logical-property mapping;
- preserve unknown properties/comments/body according to golden tests;
- prevent symlink/path traversal escape;
- use stable IDs, not filename as identity;
- explicit adoption for unmanaged notes.

## 7. Core protocol rules

Before CoreClient/server work read `21_CORE_PROTOCOL`.

- API prefix/version and envelopes are contracts;
- no hard-coded Core port;
- no unauthenticated sensitive endpoint;
- bind loopback only by default;
- pair/authenticate Plugin/CLI according to contract;
- scope every session/request to Vault identity;
- writes/start operations require idempotency identity;
- long tasks return operation ID/events instead of blocking requests.

## 8. CLI rules

`18_CLI` owns public command/flag/output/exit semantics. Do not invent alternatives inside handlers.

`doctor` stays read-only. Repair/mutation lives in explicit commands.

`--json` stdout contains only versioned JSON envelope; logs/progress go elsewhere.

## 9. Plugin rules

`19_OBSIDIAN_PLUGIN` owns product surface/lifecycle.

- `onload` registration only; no Vault scan/index/model work;
- Core-dependent features degrade cleanly;
- Plugin calls Core through CoreClient;
- offline fallback limited to specified append/create-only Inbox Capture;
- no client-side telemetry;
- lifecycle resources cleaned on unload.

## 9.1. Web Capture rules

- `web-clipper/templates/*.json` and `contracts/capture/web-capture-v1.schema.json` are normative.
- Web capture writes lightweight Inbox artifacts to `01 Inbox/Web`.
- Never generate managed entity ULIDs, primary Area, Project links or Knowledge in the browser template.
- Treat captured page text, metadata, highlights and Interpreter output as untrusted external content.
- Semantic processing/deduplication belongs to Core.

## 10. Model/Agent rules

Default route:

```text
deterministic direct
→ deterministic skill/tool
→ bounded LLM skill
→ bounded composite orchestration only if required
```

No unbounded autonomous loops.

Structured model outputs validate before use. Numeric/identity/schema decisions should not be delegated to free-form model reasoning where deterministic logic exists.

## 11. Safe write flow

```text
resolve permissions/risk
→ read + raw hash
→ build typed plan
→ snapshot/journal
→ recheck preconditions
→ atomic per-file writes
→ reparse/schema/link validation
→ diff
→ commit OR rollback/recovery
```

High-risk writes remain review-bound.

## 12. Testing expectations

Every change adds the lowest relevant tests:

```text
schema/parser       → fixture + round-trip
protocol            → contract/auth/compat
mutation            → conflict/crash/rollback
retrieval           → golden recall/ranking
Plugin              → lifecycle/CoreClient/degraded
CLI/bootstrap       → state/retry/noninteractive/JSON
Model/skill         → structured-output/golden/privacy
security            → bypass/injection/path/auth
```

Hard gates in `12_EVALS` cannot be weakened silently.

## 13. Synthetic data only

Never commit/copy real Personal Vault content, journals, contacts, health/finance data, credentials or screenshots into repo/evals/tests/logs.

## 14. Commit format

Conventional Commits required:

```text
feat(scope): ...
fix(scope): ...
refactor(scope): ...
test(scope): ...
docs(scope): ...
chore(scope): ...
security: ...
perf(scope): ...
```

## 15. Markdown metadata

Project `.md` docs created/modified by Codex follow:

```text
created: dd-mm-yy hh-mm-ss
updated: dd-mm-yy hh-mm-ss
version: SemVer
commit: Conventional Commit summary
```

Exact `AGENTS.md` filename is the deliberate exception to filename metadata.

## 16. ADR triggers

ADR required for changes to:

```text
canonical source of truth
managed note/ID/property/schema semantics
repo/package/dependency topology
Core protocol/auth
transaction semantics
platform support/distribution
agent permissions/privacy
Model Gateway route rules
primary Plugin/CLI mental model
```

## 17. Task workflow

For each substantial task:

1. read relevant specs/ADRs/contracts;
2. list affected invariants in implementation notes;
3. inspect code + machine artifacts;
4. implement smallest coherent vertical change;
5. add tests/golden cases;
6. run format/lint/typecheck/tests/contracts;
7. update schemas/examples/docs/ADR if semantics changed;
8. summarize files/decisions/limitations.

Do not add adjacent features merely because they are convenient.

## 18. Current build order

```text
repo scaffold / CI
→ CLI-0/bootstrap shell
→ Vault I/O/schema
→ Core protocol/handshake
→ Bootstrap Plugin P0
→ index/FTS
→ graph/retrieval/Context Packs
→ transaction-safe writes
→ Model Gateway
→ classify/connect/ask
→ read-first MCP
→ Review/remaining bounded Agent skills
```

Do not reorder foundational stages without ADR.

---

<!-- SOURCE: 15_DELIVERY__created-08-10-26_19-00-04__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ideomy Product Delivery & Distribution


## 1. Purpose

This document defines how Ideomy is packaged, installed, bootstrapped, updated and experienced as a product. It is authoritative for distribution/onboarding decisions together with accepted ADRs.

## 2. Delivery principle

> **Architecture may be modular. Installation must feel like one product.**

Ideomy must not be presented as a bundle of Markdown files, an Obsidian template, a manual AI-plugin stack, or a Plugin/Core assembly exercise. Public positioning remains **Ideomy — Personal Knowledge OS**.

## 3. Canonical V1 architecture

```text
USER
  ↓
Guided terminal bootstrap
`ideomy setup` / equivalent package-manager entry point
  ├── detects Obsidian + Obsidian CLI state
  ├── creates or attaches external Personal Vault
  ├── installs/enables thin Ideomy Obsidian Plugin
  ├── installs/configures local Ideomy Core
  ├── optionally configures AI/privacy choices (may be deferred)
  ├── validates/indexes
  └── opens Vault in Obsidian

Obsidian + Ideomy Plugin
  ↕ narrow localhost semantic API
Ideomy Core (separate local runtime)
  ↕ typed retrieval/mutations
External Personal Vault
```

Responsibilities:

| Layer | Responsibility |
|---|---|
| Ideomy Bootstrap CLI | guided install/update/diagnostics orchestration |
| Obsidian CLI | supported application-control bridge for plugin install/enable/open commands |
| Obsidian Plugin | in-context UX, commands, Review Queue, Ask, status, contextual actions |
| Ideomy Core | parser, schemas, SQLite/FTS, graph, retrieval, transactions, Agent, MCP, model routing, background work |
| Personal Vault | canonical user-owned Markdown/attachments/Obsidian config |

## 4. Key decision: separate Core without separate manual installation

Core remains a separate process/runtime because it provides:

- process/crash isolation;
- background operation when Obsidian is closed;
- native SQLite/indexing flexibility;
- local embeddings/local-model capability;
- MCP/CLI access independent of Obsidian;
- heavy document/indexing workflows without coupling them to Electron/plugin lifecycle.

This architectural separation **does not** imply a separate user installation task. Bootstrap installs/configures Core automatically in the same flow that prepares the Vault and Plugin.

## 5. Why not the alternatives

### Starter Vault only
Fast Alpha path, but too much manual Obsidian/plugin knowledge for a polished product.

### Plugin-only monolith
Best apparent installation surface, but over-couples heavy runtime/indexing/agent work to Obsidian/Electron lifecycle, weakens background/MCP capability and broadens plugin code surface.

### Separate native Setup/Companion application
Can provide a polished GUI, but creates another application to build, sign, update, support and explain before there is evidence that terminal onboarding blocks adoption. **Out of V1 scope.**

### Standalone Ideomy editor
Best theoretical UX control, but duplicates editor/navigation/search/sync/accessibility/platform work before PMF. Deferred.

### Cloud-first Web SaaS
Fast onboarding but conflicts with local-first ownership and canonical Markdown runtime. Web is supplementary in V1.

## 6. Canonical bootstrap command

Preferred installed CLI:

```text
ideomy setup
```

An initial package-manager entry point may be used before a global/local CLI exists, e.g. conceptually:

```text
npx @ideomy/setup
```

The exact package identifier is implementation/version dependent; the product contract is **one guided terminal bootstrap**, not the specific package manager syntax.

Do not use `curl ... | sh` as the primary trust path for public V1.

## 7. Bootstrap flow

### 7.1. Preconditions

On supported desktop systems:

- Obsidian installed;
- supported Obsidian version;
- Obsidian CLI available/enabled for fully automated Plugin setup;
- network access only where package/provider configuration requires it.

If Obsidian CLI is unavailable/disabled, bootstrap must stop before unsupported Plugin registry mutation and show exact resumable instructions. After the user enables it, the same setup flow resumes.

### 7.2. Primary choices

```text
Create new Ideomy Vault
OR
Use existing Obsidian Vault
```

### 7.3. New Vault

Bootstrap may create:

- canonical Ideomy folders;
- Templates;
- Bases;
- System notes;
- supported Obsidian configuration;
- Ideomy Plugin;
- Core configuration referencing the external Vault path.

The resulting Vault remains ordinary readable Markdown and must remain usable without Core/Agent.

### 7.4. Existing Vault

Hard rules:

- no wholesale folder migration requirement;
- no moving/deleting existing notes by default;
- unrelated YAML/properties preserved;
- bootstrap additive by default;
- bulk metadata normalization previewable;
- migrations typed/versioned/reversible;
- canonical Ideomy folders adopted progressively if desired.

Product proposition:

> **Ideomy adds a semantic/intelligence layer over the Vault you already have.**

## 8. Installation stages

### Stage 0 — Development

```text
ideomy monorepo
+ fixtures/test-vault
```

No distribution requirement.

### Stage 1 — Alpha

Canonical bootstrap logic exists in CLI:

```text
ideomy setup
ideomy init <vault-path>
ideomy doctor
ideomy status
ideomy index
```

Technical testers may tolerate documented prerequisites; no separate native installer is built.

### Stage 2 — Private Beta

Single-command guided setup installs/configures:

```text
Personal Vault
+ Ideomy Plugin
+ Ideomy Core
+ privacy/model configuration
+ initial index
```

Exit target: median time-to-first-value ≤ 5 minutes on supported desktop configurations.

### Stage 3 — Public Beta / V1

```text
ideomy setup
  → Official Ideomy Community Plugin
  → signed/integrity-verified Ideomy Core
  → optional Vault Template
  → external Personal Vault
```

The user should not need a separate native Setup/Companion application.

### Stage 4 — Post-PMF

Evaluate graphical installer or standalone Ideomy Desktop only from evidence, e.g. terminal onboarding materially blocks adoption/support or Obsidian constrains the product.

## 9. Time-to-value

V1 target:

> **Median ≤ 5 minutes from starting supported bootstrap to first useful Ideomy result.**

First-value result for an existing Vault should be concrete, e.g.:

- related project contexts found;
- recurring topics/entities detected;
- searchable contextual retrieval available;
- review candidates/decisions surfaced.

For a new Vault, the first-value path is frictionless Capture + immediate connection/context behavior.

## 10. Plugin scope

Thin Plugin capabilities:

- Ask Ideomy;
- Capture;
- Review Queue;
- contextual actions;
- System Health summary;
- diff/approval UX;
- Core status.

Do not duplicate Core's retrieval/index/transaction/MCP/background engine inside the Plugin merely to reduce installation friction.

## 11. Obsidian CLI boundary

Obsidian CLI is used for supported application-control automation such as:

- Plugin installation/enabling;
- opening the selected Vault;
- command invocation/diagnostics where supported.

It is **not** the canonical data access layer. Core reads/writes the explicitly configured external Vault through Ideomy's Vault interface and typed transaction layer.

After installation, ordinary Core indexing/retrieval/background work must function without a running Obsidian UI and without runtime dependence on Obsidian CLI.

## 12. Core lifecycle and updates

Core is installed automatically by bootstrap but remains a separate local runtime.

CLI/admin surface may expose:

```text
ideomy status
ideomy doctor
ideomy update
ideomy core start
ideomy core stop
ideomy index
ideomy reindex
ideomy migrate
```

Core binaries/updates must be integrity-verifiable. The exact service/autostart mechanism is platform-specific and must remain replaceable behind Core lifecycle contracts.

## 13. Plugin updates

Plugin updates follow the supported Obsidian Community Plugin lifecycle/security model. Ideomy bootstrap/update tooling may diagnose version compatibility but must not silently bypass Obsidian's supported plugin mechanisms.

## 14. Vault schema updates

Versioned migration:

```text
Detect version
→ Plan
→ Preview affected notes
→ Snapshot
→ Apply typed migration
→ Validate
→ Diff
→ Commit transaction / rollback
```

No silent destructive migration.

## 15. Uninstall semantics

Uninstalling Core/Plugin/CLI must preserve the Personal Vault by default. Vault deletion is a separate explicit destructive operation.

## 16. Mobile strategy

V1 mobile priority:

- capture;
- read;
- search;
- lightweight plugin/context UX where platform support allows.

Heavy indexing/synthesis/maintenance remains desktop/Core-first. Full mobile Core parity is a later evidence-driven decision.

## 17. Privacy during setup

Bootstrap communicates clearly:

- the Vault stays user-owned and local by default;
- exactly what files/configuration will be added or changed;
- what context may be sent to external AI providers;
- local-only/restricted areas;
- provider credentials are not stored in Markdown;
- Core is a local runtime with an explicitly configured Vault path.

## 18. Distribution artifacts

Possible internal/distribution artifacts:

```text
Ideomy Core binary/runtime
Ideomy Obsidian Plugin
Ideomy CLI / setup package
Ideomy Vault Template (optional)
Ideomy Web Clipper Template Pack (optional browser-capture artifact)
```

These are implementation units, not separate products or separate user installation tasks.

## 19. Success criteria

- median V1 time-to-first-value ≤ 5 minutes;
- one supported terminal command orchestrates the normal setup path;
- fresh Vault bootstrap idempotent;
- existing Vault attach non-destructive by default;
- disabled/missing Obsidian CLI has a clear resumable path;
- Plugin/Core linkage validated;
- interrupted bootstrap/update recovery tested;
- uninstall preserves Vault;
- no Personal Vault payload leakage into bootstrap/update telemetry;
- Ideomy remains usable as Markdown when Core/Plugin are disabled;
- no separate native installer required to reach V1 first value.

## 20. Out of V1 delivery scope

- separate native Setup/Companion application;
- standalone proprietary editor;
- cloud as canonical knowledge database;
- plugin-only monolith containing the full Core;
- mandatory mobile Core parity;
- forcing users to abandon existing Obsidian organization;
- manual assembly of multiple technical components as the expected public onboarding flow.


## 18. Bootstrap implementation contract

Detailed executable behavior is specified in `16 BOOTSTRAP`. Delivery work MUST use that document for:

- state-machine stages and persisted bootstrap state;
- `setup`, `status`, `doctor`, `update` and `uninstall` command semantics;
- fresh vs existing Vault flows;
- idempotency/resume/recovery behavior;
- Plugin/Core handshake and compatibility checks;
- bootstrap security/integrity requirements;
- acceptance criteria for the first installable vertical slice.

# 18. AI delivery modes

Model setup is progressive and does not gate installation health.

After deterministic bootstrap, Ideomy may offer:

```text
Configure later
Cloud API
Local AI
Hybrid
```

External AI hosts such as ChatGPT/Claude are connected separately through supported MCP/app flows and are not represented as direct Core model providers. A separate GUI installer is still out of V1 scope; model/provider setup remains CLI/plugin/settings driven.

## 21. CLI product contract

`18 CLI` is authoritative for public command hierarchy, flags, non-interactive automation, JSON output, exit/diagnostic codes, configuration precedence and update/uninstall CLI semantics.

`15 DELIVERY` defines the product journey; `16 BOOTSTRAP` defines installation state/recovery; `18 CLI` defines how those capabilities are exposed as a stable terminal interface.


# 21. Plugin delivery contract

`19 OBSIDIAN_PLUGIN` is authoritative for Plugin lifecycle, UX surfaces, Core connection, mobile behavior, Community directory policy and Product Plugin milestones.

Delivery sequencing explicitly distinguishes:

```text
Bootstrap Plugin
→ required during Bootstrap Foundation for load/status/handshake

Product Plugin
→ Ask/Capture/Review/Context/System Health added in phased milestones
```

Core remains automatically installed by CLI/bootstrap, not by Plugin self-install/update behavior.


## Engineering readiness reference

Repo/toolchain/platform baseline is canonical in `22_ENGINEERING_FOUNDATION`; Core discovery/auth is canonical in `21_CORE_PROTOCOL`; setup installs artifacts rather than inventing package topology.

## 22. Web Capture delivery

V1 browser capture is delivered as an **Ideomy template pack for the official Obsidian Web Clipper**, not as an Ideomy-maintained browser extension.

The template pack is optional and does not gate `ideomy setup → doctor → Healthy`. Setup/Plugin may surface installation/import guidance, but must not silently install browser extensions.

Public V1 supports the official Web Clipper route across the browsers/platforms supported by Obsidian. A first-party Ideomy browser extension is post-V1/evidence-driven and only justified for Ideomy-aware bidirectional browser context.

---

<!-- SOURCE: 16_BOOTSTRAP__created-09-10-26_16-54-26__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ideomy Bootstrap Foundation


## 1. Purpose

This document is the canonical executable contract for the first installable Ideomy vertical slice. Its purpose is to turn the architecture into a repeatable user journey:

```text
clean supported desktop
→ ideomy setup
→ external Personal Vault
→ Ideomy Plugin
→ Ideomy Core
→ minimal parse / validate / index
→ ideomy doctor
→ Healthy
```

No LLM, embeddings, MCP or advanced Agent workflow is required for Bootstrap Foundation acceptance.

## 2. User promise

The user should experience Ideomy installation as **one guided operation**, even though Plugin, Core and Vault remain separate architectural components.

Primary command:

```text
ideomy setup
```

Early distribution may expose an equivalent package-manager entry point such as `npx @ideomy/setup`; the behavioral contract is identical.

## 3. Required commands

### `ideomy setup`
Guided create/attach + Plugin/Core/configuration/bootstrap workflow.

### `ideomy status`
Fast non-invasive operational summary. Target output categories:

```text
Vault    <path / unavailable>
Plugin   <installed/enabled/version>
Core     <running/stopped/version>
Schema   <valid/issues>
Index    <current/stale/missing>
```

### `ideomy doctor`
Deep deterministic diagnostics with actionable remediation.

Later commands may include `init`, `index`, `reindex`, `update`, `uninstall`, but setup/status/doctor are Bootstrap P0.

## 4. Bootstrap state machine

Canonical stages:

```text
START
→ CHECK_PLATFORM
→ CHECK_OBSIDIAN
→ CHECK_OBSIDIAN_CLI
→ SELECT_MODE
→ SELECT_OR_CREATE_VAULT
→ PLAN_MUTATIONS
→ PREPARE_VAULT
→ INSTALL_PLUGIN
→ INSTALL_CORE
→ WRITE_CONFIG
→ START_CORE
→ VERIFY_HANDSHAKE
→ VALIDATE_VAULT
→ BUILD_INITIAL_INDEX
→ RUN_DOCTOR
→ OPEN_VAULT
→ DONE
```

Every stage has explicit preconditions, postconditions and a stable stage identifier suitable for logs/tests/resume.

## 5. Persisted bootstrap state

Bootstrap may persist non-secret machine state outside the Personal Vault, e.g. under a platform-appropriate Ideomy config/state directory. It should contain only what is needed to resume/diagnose:

```text
bootstrap version
selected Vault path
completed stage IDs
Plugin expected version
Core expected version
Core install path
last failure stage/code
```

Do not store provider secrets, personal note content or full prompts in bootstrap state/logs.

## 6. Idempotency and resume

`ideomy setup` MUST be safe to rerun.

Examples:

```text
Vault exists          → validate/reuse, do not create `Ideomy 2`
Plugin installed      → verify version/state, do not duplicate
Core installed        → verify/repair/start, do not duplicate
Index current         → do not rebuild unnecessarily
Partial failure       → resume from the first unsatisfied postcondition
```

The implementation must derive truth from actual system state rather than trusting a stale `completed=true` flag alone.

## 7. Setup modes

### 7.1 Create new Ideomy Vault

User selects/accepts a path. Setup previews the path and intended changes, then creates the canonical starter structure and portable system files.

Hard rules:

- never overwrite a non-empty unrelated directory without explicit user choice;
- starter content contains no personal/production data;
- resulting Vault is readable/editable without Core;
- secrets are never stored in Markdown.

### 7.2 Use existing Obsidian Vault

Default behavior is additive and non-destructive.

Setup MUST NOT by default:

- move existing notes;
- rename user folders;
- delete user files;
- normalize unrelated YAML wholesale;
- force migration into canonical folder taxonomy.

Any bulk migration is a separate previewable/reversible workflow.

## 8. Obsidian prerequisite handling

Bootstrap detects:

```text
Obsidian installed?
supported version?
Obsidian CLI available/enabled?
selected Vault visible/openable?
```

If supported CLI automation is unavailable, setup stops before unsupported internal registry mutation and shows exact resumable remediation instructions.

Do not silently edit unsupported Obsidian internal registry files merely to avoid one manual prerequisite.

## 9. Plugin installation

Public path uses the supported Obsidian plugin/CLI mechanism available for the target release. Setup verifies:

```text
plugin installed
plugin enabled
plugin version compatible with Core
plugin can reach Core health/handshake endpoint
```

The Plugin remains a thin UX/client layer. Bootstrap convenience is not a reason to move heavy Core responsibilities into it.

## 10. Core installation

Core is installed/configured automatically by setup but remains a separate local runtime. Requirements:

- versioned install;
- integrity verification appropriate to distribution channel;
- explicit install/config paths;
- localhost-only network binding by default;
- no inbound LAN exposure by default;
- Core can run ordinary parse/index/retrieval workloads without Obsidian UI/CLI after install.

## 11. Core ↔ Plugin handshake

Minimal handshake must report enough to detect incompatible installs:

```text
Core status/version
API/contract version
configured Vault identity/path fingerprint
Plugin expected contract range
index/schema state summary
```

A version mismatch is surfaced explicitly; do not continue with silently incompatible contracts.

## 12. Minimal Core capability required by Bootstrap

Bootstrap does not need Agent intelligence, but Core must provide enough deterministic substrate to prove the system works:

```text
read configured Vault
parse Markdown/frontmatter
validate minimum Ideomy schema/config
build minimal structured/full-text index
report health
```

Advanced graph/retrieval/transaction features continue in later milestones.

## 13. `ideomy status` contract

`status` is fast, read-only and suitable for support scripts. It must not repair state automatically.

Example:

```text
Ideomy
Vault    ~/Documents/Ideomy
Plugin   0.1.0 enabled
Core     0.1.0 running
Schema   valid
Index    current
```

If unavailable, report `unavailable`/`unknown` with reason rather than inventing healthy state.

## 14. `ideomy doctor` contract

`doctor` performs deeper checks grouped by layer:

```text
Environment
Obsidian / CLI
Plugin
Core
Vault permissions
Schema
Index
Version compatibility
```

Each failed check returns:

```text
stable diagnostic code
human-readable explanation
safe next action
whether automatic repair is available
```

Repair is explicit; `doctor` itself should be read-mostly unless a `--repair`/confirmed action is deliberately introduced.

## 15. Failure and recovery examples

### Obsidian CLI disabled
Stop before Plugin registry mutation; show exact enablement steps; rerun/resume.

### Plugin install succeeds, Core install fails
Keep Vault and Plugin intact; record failure stage; rerun installs/repairs Core only.

### Core installed but cannot start
Do not roll back/delete Vault. Surface Core logs/diagnostic code through doctor.

### Existing Vault is read-only
Stop before mutation; report path/permission issue.

### Initial index fails
Vault remains canonical/readable. Setup reports degraded/incomplete state; index can be retried without redoing installation.

## 16. Logging and privacy

Bootstrap logs may contain:

- stage IDs;
- versions;
- error codes;
- install/config paths where needed for local diagnostics.

They must not contain:

- note bodies;
- journal content;
- provider API keys/tokens;
- full AI prompts;
- copied production Vault content.

## 17. Update contract

`ideomy update` is designed now even if implemented after Bootstrap P0. Update order must preserve compatibility:

```text
inspect current versions
→ plan Plugin/Core/schema changes
→ verify artifacts
→ update Core/Plugin
→ preview/apply typed schema migration when needed
→ validate
→ doctor
```

No silent destructive Vault migration.

## 18. Uninstall contract

Uninstall may remove:

```text
Ideomy Core
Ideomy Plugin
Ideomy machine configuration/cache/index
```

It MUST NOT implicitly delete the Personal Vault. If Vault deletion is ever offered, it is a separately named destructive action with explicit confirmation and backup/export warning.

## 19. Test matrix

At minimum:

```text
fresh setup / new Vault
fresh setup / existing Vault
rerun after successful setup
resume after each major failure boundary
CLI unavailable/disabled
Plugin already installed older/newer
Core already installed stopped/running
read-only Vault
invalid Vault path
Core/Plugin version mismatch
index missing/stale
doctor healthy/degraded/failed
uninstall preserves Vault
```

All automated cases use synthetic disposable fixtures.

## 20. Bootstrap Definition of Done

Bootstrap Foundation is accepted only when all are true:

- one canonical setup command can create or attach a Vault;
- Plugin installation/enabling uses the supported Obsidian path;
- Core is installed/configured/started automatically;
- Plugin↔Core compatibility/health can be verified;
- minimal Vault parse/schema validation/index succeeds;
- `ideomy status` works;
- `ideomy doctor` reaches `Healthy` on supported clean setup;
- rerunning setup is idempotent;
- at least one simulated partial failure resumes successfully;
- existing Vault flow is non-destructive by default;
- uninstall semantics preserve the Vault;
- no LLM/model provider is required;
- CI/evals use only synthetic fixtures.

## 21. Out of scope for Bootstrap Foundation

```text
AI chat / Ask reasoning
embeddings / vector search
MCP
local LLM
Knowledge synthesis
Review Queue intelligence
Weekly Review
Graph UI
mobile Core parity
account/billing/cloud backend
standalone native installer
```

## 22. Codex implementation slices

Implement in this order unless an ADR changes it:

### Slice A — CLI + environment
`setup/status/doctor` command shell, stable stage/diagnostic IDs, platform/Obsidian detection.

### Slice B — Vault bootstrap
create/attach, mutation plan, starter scaffold, existing-Vault non-destructive rules.

### Slice C — Plugin + Core delivery
supported Plugin install/enable, Core install/start, config and handshake.

### Slice D — deterministic substrate
minimal parser/schema/index + health checks.

### Slice E — recovery
idempotency, persisted state, interruption tests, update/uninstall contracts.

Each slice must add tests before moving to the next.

# 24. AI configuration boundary

Bootstrap may offer model configuration after Core/Vault health is established, but it must be skippable.

Healthy Bootstrap Foundation requires:

```text
Vault reachable
Plugin installed/enabled
Core running
handshake valid
schema valid
initial deterministic index current
doctor Healthy
```

It does **not** require:

```text
API key
cloud provider
local LLM
embeddings
MCP host connection
```

Model onboarding is governed by `17 MODEL_GATEWAY` and may happen immediately after setup or later in Settings/CLI.

## 23. CLI contract boundary

`16 BOOTSTRAP` owns installation state, pre/postconditions, recovery and Bootstrap Definition of Done.

`18 CLI` owns the public command surface: command names, flags, interactive/non-interactive behavior, JSON schemas, exit/diagnostic codes, config precedence and CLI backwards compatibility.

If a CLI implementation detail conflicts with `18 CLI`, do not improvise in Bootstrap code; update the CLI contract/ADR first.

Bootstrap automated tests must exercise both human-oriented and `--non-interactive --json` paths defined by `18 CLI`.


# 25. Bootstrap Plugin boundary

Bootstrap Foundation depends only on the P0 Bootstrap Plugin defined in `19 OBSIDIAN_PLUGIN`:

```text
loads/enables
minimal Ideomy View
Core handshake
Plugin/Core protocol compatibility
active Vault identity validation
Core missing/stopped/incompatible status
```

Bootstrap does **not** require Ask, Review Queue intelligence, Entity Inspector, Weekly Review or advanced AI UI.

Setup/doctor acceptance must test Plugin load/unload + handshake without any LLM provider configured.


## Readiness dependencies

Bootstrap must use canonical monorepo/platform/distribution contracts from `22_ENGINEERING_FOUNDATION`, Vault semantics from `20`, and Core pairing/handshake from `21`.

## Web Capture onboarding boundary

Web Clipper is optional post-bootstrap onboarding. Its absence must not degrade Bootstrap health.

Setup may report an optional next action:

```text
Enable browser capture
→ install official Obsidian Web Clipper
→ import Ideomy template pack
```

Bootstrap must not silently install browser extensions or block on them.

---

<!-- SOURCE: 17_MODEL_GATEWAY__created-10-10-26_09-37-47__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ideomy Model Gateway & LLM Integration


## 1. Purpose

This document is the canonical contract for how Ideomy uses generative models, embedding models and external AI hosts. It exists to keep the Personal Knowledge OS provider-agnostic, local-first, privacy-enforceable and usable without any LLM.

Core principle:

> **Deterministic substrate first. Model intelligence second.**

LLM availability must enhance Ideomy, not own canonical knowledge or become required for Vault readability/search/schema integrity.

## 2. Four execution modes

### 2.1. Deterministic-only

No LLM configured.

Available:

- canonical Markdown Vault;
- ontology/metadata validation;
- SQLite/FTS structured search;
- typed graph traversal;
- deterministic dashboards/system health;
- transaction-safe mutations that do not require generative inference.

### 2.2. Direct Provider API

```text
Ideomy Core
→ Model Gateway
→ provider API
```

Target adapters:

- OpenAI;
- Anthropic;
- Gemini;
- OpenAI-compatible endpoint;
- optional Anthropic-compatible endpoint where justified.

Direct API usage has provider-specific credentials/billing and is not inferred from a consumer chat subscription.

### 2.3. Local inference

```text
Ideomy Core
→ Model Gateway
→ localhost-compatible endpoint
→ local/open-weight model
```

Initial target runtimes:

- LM Studio;
- Ollama;
- custom compatible endpoint.

The endpoint protocol does not guarantee model capability. Ideomy must test/detect tool use, structured output, context and embedding support for the actual configured model.

### 2.4. External AI Host

```text
ChatGPT / Claude / future MCP host
→ Ideomy MCP
→ semantic context/tools
→ Personal Vault
```

The host owns inference and its own subscription/usage policy. Ideomy is a knowledge backend/tool surface in this mode.

External-host mode does **not** provide autonomous/background Ideomy-native inference when the host is absent.

## 3. Provider vs Host — mandatory distinction

### Model Provider

Core initiates inference and receives the result.

Examples: OpenAI API, Anthropic API, Gemini API, LM Studio, Ollama.

### External AI Host

The host initiates tool calls into Ideomy.

Examples: ChatGPT custom MCP/app flows, Claude custom MCP connector flows, Codex or another MCP-capable client.

Do not emulate a provider by scraping browser sessions/cookies/private endpoints from consumer AI products.

## 4. Current provider notes — operational, not architectural

Verified 10-10-26 against official vendor documentation:

- OpenAI: ChatGPT billing and API Platform billing are separate; API use is configured separately from ChatGPT subscriptions.
- ChatGPT: custom/full MCP availability depends on current plan/workspace/developer-mode rollout; treat it as capability-discovered host integration.
- Anthropic: paid Claude chat plans and Claude Console/API are separate products; current Max/Team plans may include monthly API credits, but Ideomy still uses the official API/Console path for direct inference.
- Claude: custom remote MCP connectors are currently available across Free/Pro/Max/Team/Enterprise with plan/admin constraints.
- Gemini: Gemini API/AI Studio uses its own free/paid API billing tiers; do not assume a consumer Google AI subscription is a generic Ideomy API entitlement.
- LM Studio: exposes native plus OpenAI-compatible (and currently Anthropic-compatible) local APIs; OpenAI-compatible Responses/Chat/Embeddings endpoints are available.
- Ollama: exposes OpenAI-compatible local endpoints and tool-calling for compatible models.

These are **volatile operational facts**. They must not become permanent ontology assumptions. Provider/host capability checks and documentation can change independently of the Ideomy schema.

## 5. Model Gateway responsibilities

Model Gateway owns:

```text
provider adapters
model registry
capability registry
model profiles
privacy routing
secret references
request normalization
structured-output validation
streaming normalization
timeout/retry policy
rate-limit normalization
usage/cost metadata
fallback policy
health/capability probes
```

Model Gateway does **not** own:

```text
canonical Vault memory
entity/ontology truth
Agent permissions
Source trust policy
final write authorization
```

## 6. Provider contract

Conceptual interface:

```text
Provider
  id
  kind
  endpoint
  auth_ref
  listModels()
  getCapabilities(model)
  generate(request)
  embed?(request)
  health()
```

Capability model includes at least:

```text
text_generation
streaming
structured_output
tool_use
embeddings
vision (future/optional)
context_window
local_or_cloud
```

Capabilities must be evaluated per provider + model, not only per provider.

## 7. Model profiles

Skills request profiles rather than model names.

Initial profiles:

| Profile | Intent |
|---|---|
| `fast` | low-cost/low-latency classification and simple transformations |
| `balanced` | ordinary semantic/entity work |
| `reasoning` | multi-source synthesis and complex decisions |
| `local-private` | sensitive inference that cannot leave the device |
| `embedding` | semantic representation only |

Example configuration concept:

```yaml
profiles:
  fast:
    route: auto
  reasoning:
    route: cloud-preferred
  local-private:
    route: local-only
  embedding:
    route: local-preferred
```

Actual model identifiers remain user/config/provider data.

## 8. Routing order

Canonical routing sequence:

```text
Task/skill requirements
→ content sensitivity + agent_access
→ minimum-necessary Context Pack
→ required capabilities
→ user model profile preference
→ provider/model availability
→ budget/rate-limit constraints
→ selected route
```

Privacy precedes cost/performance.

## 9. Privacy routing

Canonical states:

```text
allowed
restricted
local_only
denied
```

Rules:

### allowed
May use configured cloud/local providers according to user profile.

### restricted
Requires workflow/session-specific permission and minimum-necessary context.

### local_only
Only approved local inference endpoints. If unavailable, fail/ask user; **never cloud fallback**.

### denied
No model access.

## 10. Secrets

Provider credentials must use an OS-appropriate secure store / secret reference. Development environment variables are permitted for local development.

Never store credentials in:

- Personal Vault Markdown;
- Source/Knowledge notes;
- prompts;
- transaction diffs;
- routine logs;
- fixtures/evals.

## 11. Direct cloud providers

### OpenAI

Adapter uses official API interfaces only. ChatGPT subscription state is not used as an API credential.

### Anthropic

Adapter uses official Anthropic API/Console credentials/credits. Claude web/desktop subscription behavior is separate from the provider adapter.

### Gemini

Adapter uses Gemini API/AI Studio/Cloud billing-compatible credentials. Consumer subscription assumptions are excluded from the contract.

Provider-specific SDK choices are implementation details behind the gateway.

## 12. Local providers

### LM Studio

Preferred integration paths:

1. OpenAI-compatible API for shared gateway behavior;
2. native API only when a capability materially requires it.

Typical local endpoint is user-configured/detected; never hard-code availability assumptions.

### Ollama

Use OpenAI-compatible or native/compatible APIs according to gateway adapter strategy. Tool calling is model-dependent.

### Custom

Advanced users may register compatible localhost/LAN endpoints subject to explicit trust/privacy configuration.

## 13. Local-model capability validation

A local model is not accepted merely because it responds to chat completions.

For a given Ideomy skill, eval at least:

```text
schema adherence
classification accuracy
tool-call correctness
context-length behavior
instruction hierarchy
prompt injection resistance
latency
resource failure behavior
```

## 14. Embeddings

Embeddings are a separate capability and may route independently from generative models.

Default strategy:

```text
structured / lexical / graph retrieval first
→ measure recall gaps
→ add embeddings only when justified
```

When embeddings are enabled, local is preferred for privacy/cost where quality is adequate. Vector index remains disposable derived state.

## 15. Fallback policy

Fallback is never a blind provider retry cascade.

A fallback candidate must satisfy:

```text
privacy class
required capabilities
user allowed providers
cost/budget policy
current health/rate limit
skill quality gate
```

Forbidden example:

```text
local_only model unavailable
→ cloud provider
```

Required behavior:

```text
local_only model unavailable
→ fail safely / ask user / defer work
```

## 16. Cost and usage

Model Gateway records privacy-safe operational metadata such as:

```text
provider/model/profile
input/output token counts when available
latency
retry/rate-limit state
estimated/returned cost metadata when available
```

Do not persist prompt bodies as routine cost telemetry.

Optional user policies:

```text
monthly budget
per-task ceiling
cloud-disabled mode
local-preferred
reasoning-model only on approval
```

## 17. Structured output

Generative skills that affect structured state must define a schema.

```text
model output
→ parse
→ runtime schema validate
→ semantic validate
→ proposal/review
→ typed mutation
```

Raw free-form prose never directly mutates canonical metadata.

## 18. First LLM-backed capabilities

Build order:

### M2.1 — `classify`

```text
Inbox item
→ minimal taxonomy/context
→ model profile `fast/balanced`
→ typed classification proposal
→ validation
→ review/safe action
```

### M2.2 — `connect`

```text
entity/note
→ deterministic candidate retrieval
→ model relation/rerank proposal
→ validated typed links
```

### M2.3 — `ask`

```text
question
→ structured/lexical/graph retrieval
→ Context Pack
→ reasoning profile
→ answer + provenance
```

### M2.4 — Source / Knowledge synthesis

Only after retrieval, creation-threshold and duplicate evals are stable.

## 19. External-host MCP mode

Purpose:

> allow users to use Ideomy knowledge from an AI product they already subscribe to/use.

Examples:

```text
Claude
→ Ideomy MCP
→ search/context/decisions/projects

ChatGPT
→ supported custom MCP/app integration
→ Ideomy MCP
```

Policy:

- host receives only scoped permitted context;
- host model identity/plan is not assumed by Ideomy;
- read-first by default;
- write tools remain separately approval-gated;
- host integration cannot bypass `agent_access`/privacy filtering.

## 20. Bootstrap/model onboarding

Bootstrap DoD remains model-independent.

After `ideomy doctor` is healthy, setup/Plugin may offer:

```text
Configure AI now?

○ Later
○ Cloud API
○ Local
○ Hybrid
```

Recommended default for privacy-conscious power users: **Hybrid**.

## 21. CLI/settings surface — target contract

Potential commands (exact syntax may evolve):

```text
ideomy models status
ideomy models list
ideomy models add
ideomy models test
ideomy models route
```

Do not implement a large model-management UI before contracts/evals stabilize.

## 22. Evals

Required gateway-level gates:

- provider contract consistency;
- capability detection;
- structured output;
- tool calling where used;
- local endpoint conformance;
- privacy routing;
- no local-only cloud fallback;
- secret leakage;
- provider fallback rules;
- rate-limit/timeouts;
- model-profile routing;
- first-skill classification quality.

## 23. Definition of Done — M2 Model Gateway

M2 foundation is accepted when:

- Ideomy works normally with zero model providers;
- at least one OpenAI-compatible/local route passes conformance;
- at least one first-party cloud adapter passes contract tests;
- privacy routing blocks forbidden exposure;
- secrets are external to Vault;
- structured outputs are validated;
- profile routing is model-name independent;
- provider failures/fallbacks are observable and policy-bound;
- `classify` passes its golden eval threshold across the supported model profile(s).

## 24. Non-goals for initial M2

- model fine-tuning;
- proprietary browser-session scraping;
- automatic ontology evolution;
- unbounded agent loops;
- cloud dependency for basic Ideomy;
- model marketplace;
- automatic cheapest-provider bidding;
- sending the entire Vault to any provider.

## 24. CLI model-management boundary

User/admin model configuration commands are defined by `18 CLI`; provider semantics, profiles, routing, secrets and privacy remain defined here.

CLI commands MUST NOT:

- represent ChatGPT/Claude consumer subscriptions as direct provider API credentials;
- print provider secrets;
- use arbitrary Personal Vault content for provider health tests;
- override `local_only`/`denied` routing constraints.

The initial CLI surface is `ideomy models list/status/test/configure` and is implemented only when M2 Model Gateway work begins.


# Plugin boundary

Ideomy Plugin never calls provider/model APIs directly. Plugin invokes Core semantic workflows; Core applies privacy policy and Model Gateway routing. Plugin settings may display model/profile/provider status but do not own provider credentials.

See `19 OBSIDIAN_PLUGIN`.


## Readiness dependency

Model Gateway is a package inside the canonical `ideomy` monorepo. It uses `CredentialStore`/platform abstractions from `22` and never creates an alternate Core transport.

---

<!-- SOURCE: 18_CLI__created-10-10-26_14-47-32__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ideomy CLI — Product & Technical Contract


## 1. Purpose

This document defines the stable user-facing and automation-facing contract for the Ideomy command-line interface.

The CLI is simultaneously:

- the canonical V1 bootstrap/install surface;
- the local administration surface for Ideomy Core;
- the deterministic diagnostics surface for support/CI;
- an automation interface for setup/status/validation/update workflows;
- a thin caller of Core/domain contracts, not an alternative implementation of Ideomy business logic.

Core principle:

> **One command for ordinary users; explicit stable contracts for automation and advanced users.**

The normal user should rarely need more than:

```text
ideomy setup
ideomy status
ideomy doctor
ideomy update
```

Advanced subcommands exist for diagnostics and administration but do not define the primary product experience.

## 2. CLI design principles

### 2.1. Calm and precise

Output is concise, factual and actionable. Avoid anthropomorphic, celebratory or magical copy.

Preferred:

```text
Vault     ready
Plugin    enabled · 0.1.0
Core      running · 0.1.0
Index     current
```

Avoid:

```text
✨ Great! Your second brain is alive!
```

### 2.2. Safe by default

- no destructive Vault mutation without explicit scope/confirmation;
- no silent unsupported Obsidian registry mutation;
- no secret values printed by default;
- no cloud model call caused merely by `status`/`doctor`;
- no `--force` flag that bypasses privacy/integrity invariants in V1.

### 2.3. Idempotent and scriptable

Commands that reconcile desired state (`setup`, `update`, `repair`) inspect actual state and are safe to retry according to their contracts.

### 2.4. Human and machine parity

Any important interactive workflow must expose an equivalent non-interactive path. Read/status commands support stable JSON output.

### 2.5. Core owns domain behavior

CLI parses arguments, renders prompts/output and invokes Core/installer contracts. It must not duplicate parser/schema/retrieval/mutation logic.

## 3. Canonical command hierarchy

### 3.1. Primary commands — P0/P1

```text
ideomy
├── setup
├── status
├── doctor
├── repair
├── update
├── uninstall
│
├── core
│   ├── status
│   ├── start
│   ├── stop
│   ├── restart
│   └── logs
│
├── vault
│   ├── status
│   ├── validate
│   └── open
│
├── index
│   ├── status
│   ├── build
│   └── rebuild
│
└── config
    ├── list
    ├── get
    ├── set
    └── path
```

### 3.2. Model commands — introduced with Model Gateway M2

```text
ideomy models
├── list
├── status
├── test
└── configure
```

Secrets/auth are handled through secure provider flows or environment/credential-store integration, not ordinary `config set <api-key>` plaintext.

### 3.3. Later/optional commands

May be added after demonstrated need:

```text
ideomy search
ideomy diagnostics bundle
ideomy completion
ideomy migrate
```

Adding a command is not a reason to expose internal implementation detail. Public commands should represent durable user/admin capabilities.

## 4. Global options

All commands inherit where meaningful:

```text
--help, -h
--version, -V
--json
--quiet, -q
--verbose, -v
--no-color
--config <path>
--vault <path>
--non-interactive
--yes, -y
```

Rules:

- `--json` emits machine-readable output and disables decorative/ANSI output on stdout;
- `--quiet` suppresses ordinary progress but not fatal errors;
- `--verbose` adds operational diagnostics but never secrets/note bodies;
- `--config` selects an alternate machine config for testing/support;
- `--vault` explicitly scopes a command to a Vault when supported;
- `--non-interactive` forbids prompts: missing required input becomes a usage/precondition failure;
- `--yes` accepts ordinary safe confirmations but never authorizes a separately defined destructive Vault-delete operation;
- `--yes` does not bypass integrity/privacy/version checks.

Unknown flags fail with exit code `2` and show concise usage.

## 5. Interactive vs non-interactive contract

### 5.1. Default behavior

If stdin/stdout are attached to a TTY and `--non-interactive` is absent, commands may prompt.

### 5.2. Automation behavior

`--non-interactive` guarantees:

- no prompt/read from stdin;
- no interactive selector;
- required decisions supplied by flags/config;
- predictable exit code;
- no waiting for manual remediation.

Example interactive:

```text
ideomy setup
```

Equivalent automation concept:

```text
ideomy setup \
  --new \
  --vault ~/Documents/Ideomy \
  --yes \
  --non-interactive
```

Interactive-only behavior without an automation equivalent is not accepted for a core workflow.

## 6. Output channels

### 6.1. Human mode

- normal result/progress → stdout;
- warnings/errors/diagnostic detail → stderr where appropriate;
- progress output may update in place only in TTY mode;
- no spinner/progress control characters when output is redirected.

### 6.2. JSON mode

`--json` writes exactly one valid JSON document to stdout for non-streaming commands.

Operational logs/progress go to stderr and must not corrupt stdout JSON.

Canonical envelope:

```json
{
  "schema_version": "1",
  "command": "status",
  "ok": true,
  "status": "healthy",
  "data": {},
  "diagnostics": [],
  "meta": {
    "cli_version": "0.1.0"
  }
}
```

Fields:

- `schema_version` — machine-output contract version;
- `command` — canonical command identifier;
- `ok` — whether command contract succeeded;
- `status` — semantic state (`healthy`, `degraded`, `failed`, etc. where applicable);
- `data` — command-specific typed payload;
- `diagnostics` — stable diagnostic entries;
- `meta` — version/timing/non-sensitive execution metadata.

Breaking JSON-schema changes require explicit schema/version migration and SemVer-compatible CLI release policy.

## 7. Diagnostic object

Canonical diagnostic shape:

```json
{
  "code": "CORE-004",
  "severity": "error",
  "message": "Ideomy Core is installed but not running.",
  "remediation": "Run `ideomy core start` or `ideomy repair`.",
  "repairable": true
}
```

Severities:

```text
info
warning
error
fatal
```

Diagnostic code families:

```text
ENV-*       platform/runtime
OBS-*       Obsidian / Obsidian CLI
VAULT-*     Vault path/permissions/state
PLUGIN-*    Ideomy Plugin
CORE-*      Ideomy Core/runtime/handshake
SCHEMA-*    ontology/schema/frontmatter
INDEX-*     index/FTS/derived state
MODEL-*     Model Gateway/provider/local inference
DIST-*      download/update/distribution
SEC-*       integrity/privacy/security policy
CONFIG-*    configuration
```

Diagnostic code meanings are stable once released; wording may improve without changing code semantics.

## 8. Exit codes

V1 stable exit-code classes:

| Code | Class | Meaning |
|---:|---|---|
| `0` | success | command succeeded / requested health condition met |
| `1` | unexpected | uncategorized internal failure |
| `2` | usage | invalid arguments/options or missing required non-interactive input |
| `10` | prerequisite | unsupported platform or missing/unavailable prerequisite |
| `20` | vault/config | Vault/configuration unavailable, invalid or unwritable |
| `30` | plugin | Plugin install/enable/compatibility failure |
| `40` | core | Core install/start/health/handshake failure |
| `50` | schema/index | deterministic schema/index validation failure |
| `60` | model | configured model/provider failure for a command requiring AI |
| `70` | policy/integrity | privacy/security/integrity policy prevented operation |
| `80` | distribution/network | artifact download/update/network failure |
| `90` | recovery-required | partial operation left resumable/recoverable work |
| `130` | interrupted | user/SIGINT interruption where platform allows conventional mapping |

A specific diagnostic code provides detail; exit codes remain broad stable automation classes.

`doctor` returns `0` only when all required checks for the requested scope pass. Non-fatal optional-capability warnings can still be represented as `warning` while overall status remains healthy; deterministic rules define which checks degrade/fail health.

## 9. Configuration model

### 9.1. Precedence

Highest to lowest:

```text
explicit CLI option
→ supported environment variable
→ machine/user Ideomy config
→ portable Vault-level Ideomy config
→ built-in default
```

Privacy/security restrictions cannot be weakened by a lower-precedence source.

### 9.2. Machine config

Use platform-appropriate OS application/config directories. Do not invent one cross-platform path when the OS provides a standard location.

Machine config may contain:

```text
configured Vault references
Core install/runtime settings
channel/update settings
non-secret provider/model preferences
logging preferences
```

### 9.3. Vault config

Contains portable non-secret Ideomy metadata/configuration needed to understand the Vault independent of a specific machine.

### 9.4. Secrets

Secrets are never written into canonical Markdown or ordinary JSON config.

Supported secret sources may include:

```text
OS credential store/keychain
provider-auth flow
process environment variables
```

`ideomy config list/get` redacts secret references/values.

## 10. `ideomy setup`

Canonical install/bootstrap command. Detailed state machine remains authoritative in `16 BOOTSTRAP`; this section defines public CLI surface.

### 10.1. Options

```text
--new
--existing
--vault <path>
--channel <stable|beta|dev>
--skip-open
--skip-index
--non-interactive
--yes
```

Rules:

- `--new` and `--existing` are mutually exclusive;
- without either in interactive mode, prompt;
- in non-interactive mode one must be inferable safely from path/state or explicitly provided;
- `--skip-index` is advanced/test support and results in a non-fully-ready state; `doctor` reflects that;
- public stable setup defaults to `stable` channel;
- setup never requires an LLM configuration.

### 10.2. Human output

Prefer phase/state output:

```text
Ideomy Setup

Environment   ready
Obsidian      1.14.x · CLI enabled
Vault         ~/Documents/Ideomy
Plugin        installed · enabled
Core          installed · running
Schema        valid
Index         current

Ideomy is ready.
```

### 10.3. JSON output

Returns stage results and final state, including resumable failure stage on exit `90`.

## 11. `ideomy status`

Fast, read-only, no repair, no cloud call.

Default scope:

```text
Vault
Plugin
Core
Schema
Index
```

Example:

```text
Ideomy
Vault     ~/Documents/Ideomy
Plugin    0.1.0 · enabled
Core      0.1.0 · running
Schema    valid
Index     current
```

Target latency: fast enough for shell/support use; do not perform a full reindex/deep scan.

JSON data fields are typed/stable and include component versions/contract compatibility where known.

## 12. `ideomy doctor`

Deep **read-only by default** diagnostics.

Checks:

```text
Environment
Obsidian / CLI
Plugin
Core
Vault permissions
Vault configuration
Schema
Index
Plugin↔Core contract compatibility
Core↔Vault identity
Model Gateway configuration (optional capability; must not make deterministic Ideomy unhealthy)
```

Options:

```text
--json
--verbose
--vault <path>
--bundle <path>   # sanitized diagnostics bundle, optional/P1
```

`doctor` never silently repairs. Repair actions are delegated to `ideomy repair`.

## 13. `ideomy repair`

Repairs known deterministic conditions only.

Flow:

```text
diagnose
→ build repair plan
→ show plan
→ explicit confirmation / --yes
→ apply narrow repair
→ validate
→ doctor
```

Examples:

- restart/re-register Core lifecycle;
- rebuild derived index;
- reconcile supported Plugin enablement/version state;
- regenerate disposable machine cache;
- repair missing non-secret machine config from explicitly selected Vault.

Not allowed:

- bulk rewrite user notes as a generic repair;
- weaken privacy policy;
- delete Personal Vault;
- bypass unsupported Obsidian mechanisms;
- silently change ontology semantics.

## 14. `ideomy core`

Advanced lifecycle namespace:

```text
ideomy core status
ideomy core start
ideomy core stop
ideomy core restart
ideomy core logs
```

CLI hides platform-specific service management behind a Core lifecycle adapter.

V1 target adapters:

```text
macOS   user-level launch/service mechanism
Windows user/service mechanism appropriate to signed V1 distribution
Linux   user-level systemd where available, documented fallback otherwise
```

Exact implementation may vary by release, but command semantics remain stable.

`core logs`:

```text
--follow
--lines <n>
--json   # if structured logs supported
```

Logs must be privacy-sanitized according to `08 SAFETY`.

## 15. `ideomy vault`

```text
ideomy vault status
ideomy vault validate
ideomy vault open
```

### `vault status`
Reports configured path/identity/read/write state without scanning entire content.

### `vault validate`
Runs deterministic schema/config/link checks according to selected validation depth. It does not rewrite notes.

Possible later options:

```text
--changed-only
--strict
--json
```

### `vault open`
Uses supported Obsidian application-control path to open the configured Vault. Failure to open UI does not imply Core/Vault invalidity.

## 16. `ideomy index`

```text
ideomy index status
ideomy index build
ideomy index rebuild
```

Rules:

- index is derived/disposable;
- `build` creates/updates missing/stale derived state without unnecessary destructive rebuild;
- `rebuild` explicitly discards/recreates derived index after confirmation where needed;
- neither command changes canonical Markdown content;
- status reports schema/index version and freshness basis.

## 17. `ideomy config`

```text
ideomy config list
ideomy config get <key>
ideomy config set <key> <value>
ideomy config path
```

Constraints:

- only public, documented config keys are accepted;
- unknown keys fail rather than being silently stored;
- secret material is not accepted by ordinary `config set` unless a secure secret-reference mechanism explicitly handles it;
- `config list/get` redacts secrets and private tokens;
- changing a setting that requires restart/index rebuild reports the required next action.

## 18. `ideomy update`

Canonical update flow:

```text
inspect installed versions
→ fetch/verify release metadata
→ compatibility preflight
→ plan Core/Plugin/schema changes
→ show plan
→ update artifacts
→ run typed schema migration if needed
→ start/handshake
→ validate
→ doctor
```

Options:

```text
--check
--channel <stable|beta|dev>
--yes
--non-interactive
--json
```

Rules:

- update never deletes Personal Vault;
- incompatible Core/Plugin combinations are not silently activated;
- failed update preserves or restores last known working Core/Plugin when distribution mechanism supports rollback;
- schema migrations are separately transaction-safe and previewable;
- `--check` is read-only.

## 19. `ideomy uninstall`

User-facing contract:

```text
Will remove
- Ideomy Core
- Ideomy Plugin
- Ideomy machine config/cache/index

Will preserve
- Personal Vault
- Markdown
- attachments
```

Default uninstall never deletes Vault.

Options may include:

```text
--keep-plugin
--keep-core
--yes
--non-interactive
--json
```

Granular options are optional for implementation; if unsupported they must fail clearly rather than be ignored.

A future Vault-delete command, if ever implemented, is distinct, explicitly destructive and not an `uninstall` option hidden behind `--force`.

## 20. `ideomy models` — M2 contract

Introduced only when `17 MODEL_GATEWAY` implementation begins.

```text
ideomy models list
ideomy models status
ideomy models test [profile|provider]
ideomy models configure
```

`models status` reports configured routes/capabilities without exposing credentials.

`models test` uses synthetic/non-sensitive prompts by default and must not sample arbitrary Personal Vault content merely to test a provider.

`models configure` may be interactive; non-interactive provider configuration uses documented config + secure-secret mechanisms.

Consumer ChatGPT/Claude subscription-host integrations are not configured as fake provider API credentials; host/MCP connection flows remain governed by `17 MODEL_GATEWAY`/`09 CONNECTORS`.

## 21. Distribution channels

Canonical channels:

```text
stable
beta
dev
```

Rules:

- stable never installs dev artifacts implicitly;
- changing channel is explicit;
- release metadata/artifacts are integrity-verifiable;
- Core/Plugin/CLI compatibility ranges are checked before activation.

## 22. Version and compatibility model

Track separately:

```text
CLI version
Core version
Plugin version
Core API/contract version
Vault/schema version
JSON output schema version
```

A product release may align versions for convenience but compatibility must be based on declared contract ranges, not equality alone.

Example handshake concept:

```text
plugin core_api: ^1
core core_api: 1.2
→ compatible
```

CLI must surface mismatches clearly through status/doctor/update.

## 23. Backward compatibility

Once public V1 CLI is released:

- removing/renaming a command or option is breaking;
- changing an option's meaning is breaking;
- changing exit-code class semantics is breaking;
- incompatible `--json` schema changes require schema-version change and appropriate SemVer treatment;
- additive fields/commands/options are normally non-breaking;
- human-readable wording/layout may evolve without being machine contract.

Automation must depend on JSON/exit codes/diagnostic codes, not parse human output.

## 24. Error UX

An error answers three questions:

```text
What failed?
What was preserved?
What should I do next?
```

Example:

```text
Core could not start. [CORE-004]

Your Vault was not modified.
Run `ideomy doctor` for details or `ideomy repair` to attempt a safe repair.
```

Never show a raw stack trace by default. `--verbose` may expose sanitized developer detail.

## 25. Cancellation and signals

- `Ctrl+C` / SIGINT stops at a safe interruption boundary where possible;
- partial setup/update persists resumable state;
- canonical Vault writes complete atomically or roll back according to transaction contract;
- exit `130` is used for conventional user interruption where applicable;
- no background child should be orphaned unintentionally after CLI cancellation.

## 26. Logging and diagnostics bundle

Machine logs live in platform-appropriate state/log directories, not in canonical Vault by default.

Logs may include:

```text
timestamp
component
operation/stage ID
version
diagnostic code
non-sensitive path metadata when necessary
```

Logs must not include by default:

```text
note bodies
journal content
full prompts
API keys/tokens
private attachment contents
```

A future diagnostic bundle must be sanitized and enumerate exactly what it contains before sharing.

## 27. Security rules

- do not accept provider secrets via command-line flags that leak into shell history/process lists when avoidable;
- prefer secure prompt/credential store/environment references;
- no arbitrary shell subcommand passthrough;
- no raw SQL/filesystem mutation command for ordinary users/agents;
- update artifacts require integrity verification appropriate to channel;
- localhost services bind narrowly per architecture;
- `--verbose` never disables redaction;
- `--json` never includes secret material.

## 28. Telemetry

CLI must function with telemetry disabled.

If product telemetry is later introduced:

- explicit policy/consent as required;
- no note bodies or personal Vault payloads;
- no secrets;
- installation/diagnostic events use coarse non-sensitive metadata;
- local logs and remote telemetry remain distinct.

## 29. Testing matrix

### Command-contract tests

```text
help/version
unknown command/flag
interactive prompt path
non-interactive missing input
--json validity
stdout/stderr separation
exit-code mapping
diagnostic-code stability
no-color / redirected output
```

### Setup tests

Reuse `16 BOOTSTRAP` matrix plus CLI flags/non-interactive variants.

### Config tests

```text
precedence
invalid key/type
redaction
alternate --config
Vault override
```

### Platform lifecycle tests

```text
Core start/stop/restart/status
service unavailable
crash/recovery
logs
```

### Update tests

```text
check only
compatible update
Core/Plugin mismatch
network failure
integrity failure
schema migration failure
rollback/recovery
```

### Safety tests

```text
uninstall preserves Vault
no secret in JSON/logs
no note content in diagnostic bundle
local-only model policy not bypassed by CLI
Ctrl+C does not corrupt canonical Vault
```

All automated tests use synthetic disposable Vaults.

## 30. CLI eval/quality gates

Before public V1:

- 100% P0 command help examples parse successfully;
- `--json` conforms to versioned schemas;
- stable exit-code conformance tests pass;
- setup rerun/recovery matrix passes on supported platforms;
- uninstall-preserves-Vault = 100%;
- secret-redaction tests = 100%;
- no test requires production Personal Vault;
- median supported setup time meets Delivery target;
- human usability test can complete setup without reading engineering documentation beyond documented Obsidian CLI prerequisite.

## 31. Implementation guidance

Recommended TypeScript layering:

```text
apps/cli
  command definitions
  prompts/renderers
  exit/output mapping

packages/contracts
  command result schemas
  diagnostic codes
  JSON schemas

packages/bootstrap
  setup state machine

packages/core-client
  Core lifecycle/API client

packages/platform
  OS paths/service/process adapters
```

Do not put domain parsing/index/mutation logic in command handlers.

CLI framework choice is an implementation decision evaluated for:

```text
TypeScript typing
subcommands/options
help generation
testing
completion support
package size
maintenance
```

No framework is an architecture invariant.

## 32. P0 implementation slices

### CLI-0 — Skeleton

```text
ideomy --help
ideomy --version
ideomy setup
ideomy status
ideomy doctor
```

Typed command results + output/exit mapper.

### CLI-1 — Automation contract

```text
--json
--non-interactive
--yes
stable diagnostics
stable exit classes
```

### CLI-2 — Bootstrap integration

Wire `setup` to `16_BOOTSTRAP` state machine and synthetic tests.

### CLI-3 — Admin namespaces

```text
core status/start/stop/restart/logs
vault status/validate/open
index status/build/rebuild
```

### CLI-4 — Lifecycle

```text
repair
update
uninstall
```

### CLI-5 — Model Gateway

Add `models` only when M2 begins.

## 33. Definition of Done — CLI Foundation

CLI Foundation is accepted when:

- canonical command hierarchy exists;
- `help/version/setup/status/doctor` work;
- interactive and non-interactive setup paths exist;
- `--json` has versioned schema and clean stdout;
- exit-code classes/diagnostic-code registry are tested;
- setup is idempotent/resumable via `16_BOOTSTRAP`;
- status/doctor are read-only;
- `repair` is explicit and plan-based;
- config precedence and secret redaction are implemented/tested;
- Core lifecycle is abstracted behind platform adapter;
- update/uninstall preserve Vault invariants;
- docs/examples match implementation;
- CI uses only synthetic fixtures.

## 34. Out of scope for CLI Foundation

```text
full-screen terminal UI
interactive knowledge browsing
AI chat in terminal
terminal editor
arbitrary shell passthrough
generic filesystem commands
generic SQL
remote cloud administration
standalone GUI installer
```

The CLI is an installation/admin/automation surface, not a replacement for Obsidian or the Ideomy Plugin.


# Plugin lifecycle boundary

CLI/bootstrap owns Plugin installation/enabling/update compatibility diagnostics. The Plugin itself does not install/update Core or dependencies. `ideomy status` / `doctor` should expose Plugin version/enabled/handshake compatibility states defined in `19 OBSIDIAN_PLUGIN`.


## Readiness dependency

CLI talks to Core through shared CoreClient/protocol contracts from `21`; repository/package/platform choices are fixed in `22`; commands do not directly mutate Vault outside typed packages.

---

<!-- SOURCE: 19_OBSIDIAN_PLUGIN__created-10-10-26_14-56-08__updated-12-10-26_16-30-30__v0.11.0.md -->

# Ideomy Obsidian Plugin — Product & Technical Contract


## 1. Purpose

This document is the canonical product, UX and technical contract for the **Ideomy Obsidian Plugin**.

The Plugin exists to make Ideomy feel native inside Obsidian while preserving the architectural boundary:

```text
Obsidian UI / active context
        │
        ▼
Ideomy Plugin
        │
        ▼
versioned local Core protocol
        │
        ▼
Ideomy Core
        │
        ▼
external Personal Vault
```

The Plugin is **not** the canonical knowledge store, primary indexer, model runtime, MCP server or transaction engine.

## 2. Product principle

> **The user should feel that Ideomy is part of Obsidian; the system should remain operable and recoverable when the Plugin is absent.**

The Plugin optimizes in-context interaction. Core owns heavy intelligence and safe mutation semantics. The Vault remains user-owned Markdown.

## 3. Architecture boundary

### Plugin owns

```text
Obsidian-native UI
commands / ribbon / context menus
active-note and selection context
Review Queue presentation
Diff / approval interaction
Core connection state
settings UI
lightweight mobile/offline capture
navigation into Vault notes/views
```

### Core owns

```text
Markdown/frontmatter parsing
schema validation
SQLite/FTS/graph indexes
retrieval and Context Packs
entity resolution
transaction-safe typed mutations
Agent orchestration
Model Gateway
MCP
background processing
Core logs/health
```

### Vault owns

```text
canonical Markdown
attachments
portable Ideomy metadata
Obsidian configuration chosen by the user
```

The Plugin must never maintain a shadow canonical knowledge database.

## 4. Two implementation scopes

The same plugin product is delivered progressively. Do not create separate Bootstrap and Product plugin packages.

### 4.1. Bootstrap Plugin — M0

Minimum surface required to prove installation/integration:

```text
Plugin loads successfully
Core connection/handshake
Plugin/Core/version status
Open Ideomy surface
minimal diagnostics
```

No Ask, Review intelligence, entity inspector or advanced AI UI is required for Bootstrap Foundation acceptance.

### 4.2. Product Plugin — later milestones

Adds:

```text
Ask
Capture
Review Queue
Diff / Approve / Reject
Current Context
Entity Inspector
Typed Relations
Project Context
Weekly Review
System Health
AI/Models settings surface
```

This separation prevents full UI scope from blocking the first installable vertical slice.

## 5. Obsidian manifest contract

Initial public identity:

```text
id: ideomy
name: Ideomy
```

Rules:

- `id` follows Obsidian Community Plugin naming rules;
- `minAppVersion` is explicitly pinned to the oldest version Ideomy actively tests;
- `isDesktopOnly: false` is preferred for V1 Plugin so lightweight mobile surfaces remain available;
- therefore Plugin source and dependencies must not require Node.js or Electron APIs;
- desktop-only capability lives in separate Ideomy Core, not hidden inside Plugin imports.

If future Plugin code requires Node/Electron, it must first be justified by ADR because it would remove mobile installability.

## 6. Distribution contract

Public distribution targets the Obsidian Community directory.

Hard rules:

- Plugin does not self-install or self-update itself;
- Plugin does not download/install/update Core or arbitrary dependencies;
- Core installation/update is owned by `ideomy setup` / `ideomy update` outside the Plugin;
- Plugin may detect missing/incompatible Core and show exact remediation;
- plugin update compatibility is diagnosed before/after supported Obsidian ecosystem updates.

Alpha/dev installation may use development paths, but production code must not depend on unsupported registry mutation.

## 7. Plugin lifecycle

### `onload`

Keep synchronous initialization minimal:

```text
load lightweight plugin settings
register views
register commands
register ribbon/context actions
register Settings tab
register lifecycle-safe events
```

Do **not** during `onload`:

```text
scan the Vault
build indexes
call LLM providers
run migrations
start heavy Core jobs
fetch large datasets
block on Core availability
```

Core connection and context refresh occur after Obsidian layout is ready.

### `onunload`

All views, registered events, timers, DOM listeners, streams and in-flight UI subscriptions must be cleaned up through Obsidian lifecycle/component APIs.

## 8. Performance budgets

V1 targets, measured on supported desktop baselines:

```text
Plugin synchronous onload self-time        <= 50 ms target
No full Vault scan in Plugin               mandatory
First Ideomy View skeleton                 <= 100 ms target
Core-connected useful state                <= 500 ms target when Core healthy/local
Context refresh                            debounced / non-blocking
Background polling                         avoid when push/event channel is available
```

Budgets are regression targets, not permission to bypass correctness/privacy.

## 9. Primary information architecture

Ideomy adds **one primary dockable Ideomy View**, not many competing permanent sidebars.

Recommended internal modes:

```text
Home / Status
Ask
Review
Context
Health
```

Commands can deep-link the primary View into the relevant mode.

This keeps Obsidian workspace chrome small while allowing multiple workflows.

## 10. Default placement

Desktop default recommendation:

> open Ideomy View in the **right sidebar** so the current note/editor remains the primary center surface.

Users may move the view using normal Obsidian workspace behavior. Do not hard-code physical placement after initial open.

On mobile, use the platform-appropriate full-width/leaf behavior supplied by Obsidian rather than reproducing desktop sidebar geometry.

## 11. Ribbon

One Ideomy ribbon action is allowed by default:

```text
Ideomy
→ open/toggle primary Ideomy View
```

Rules:

- one persistent icon maximum by default;
- user may disable/hide it in Plugin settings if feasible;
- no separate ribbon icons for Ask/Capture/Review/Health;
- frequent actions live in Command Palette/hotkeys/context menus.

## 12. Command registry

P0/MVP user-facing commands:

```text
Ideomy: Open
Ideomy: Ask
Ideomy: Capture
Ideomy: Process current note
Ideomy: Open Review Queue
Ideomy: Open current project
Ideomy: Weekly Review
Ideomy: System Health
```

Later contextual commands may include:

```text
Ideomy: Ask about selection
Ideomy: Capture selection
Ideomy: Find related knowledge
Ideomy: Create decision from selection
Ideomy: Open entity context
```

Technical rules:

- command IDs are stable once public;
- command IDs do not redundantly include the Plugin ID because Obsidian prefixes them;
- removed/renamed public command IDs require migration/compatibility consideration;
- every command has a defined availability predicate and degraded-state behavior.

## 13. Command availability

Examples:

```text
Open                     always when Plugin loaded
Capture                  available with or without Core
Ask                      requires healthy Core + usable Model Gateway route
Process current note     requires current Markdown note + healthy Core
Review Queue             available if Core reachable; otherwise view shows degraded state
Open current project     only if current context resolves to Project relation
Weekly Review            requires Core + relevant deterministic substrate
System Health            always opens; may report Core unavailable
```

Unavailable commands explain why rather than failing silently.

## 14. Current-context model

The Plugin provides Core with **context pointers**, not unnecessary copies of the Vault.

Default current-note context:

```text
Vault identity
active file path
resolved Ideomy entity ID if known
active selection/range if explicitly relevant
workspace context requested by command
```

Core reads canonical file content itself.

For unsaved transient editor text, Plugin may send the minimum explicitly invoked transient selection/text and label it non-canonical.

## 15. Ask UX

Ask is context-aware semantic retrieval + reasoning, not a generic chat-first replacement for Obsidian.

Required behavior:

```text
question
→ visible scope/context
→ Core retrieval / Context Pack
→ Model Gateway when required
→ answer
→ provenance links back to Vault entities/sources
```

### Ask session state

- conversation/session context is transient by default;
- chat transcript does not become canonical Knowledge automatically;
- explicit actions may save a result as Source/Knowledge/Decision candidate;
- user can see/change scope where practical;
- responses distinguish retrieved fact from new inference/recommendation.

## 16. Ask visual structure

Minimum answer anatomy:

```text
Answer / synthesis

Context used
- [[Project A]]
- [[Decision B]]
- [[Knowledge C]]

Actions
Save as knowledge / Create decision / Open source (when applicable)
```

Do not add fake citations to notes that were not used.

## 17. Capture UX

Primary principle:

> Capture first; classify later.

Desktop interaction may be modal/quick-input invoked from command/hotkey.

Minimum fields:

```text
content
optional source URL/reference
optional target Project/context
```

No mandatory Area/type/topic questions during quick capture.

## 18. Offline / Core-unavailable capture

Capture is a deliberate narrow exception to the general Core-owned mutation path.

If Core is unavailable, Plugin may perform **append/create-only Inbox capture** using Obsidian Vault APIs, provided that:

- it creates a new file only;
- it never rewrites an existing canonical note;
- filename collision handling is deterministic;
- metadata is minimal and schema-compatible;
- no semantic classification is invented;
- the item is marked for later processing when Core returns.

This exception enables mobile/offline capture without weakening general typed-mutation rules.

## 19. Process current note

For a Source/inbox/current note, Product Plugin may request Core processing.

UI shows results as categories rather than opaque prose:

```text
Updated existing knowledge     2
New knowledge candidates       1
Relations proposed             3
Nothing new                    allowed outcome
Needs review                   1
```

Processing never silently creates/merges high-impact canonical Knowledge when policy requires review.

## 20. Review Queue

Review Queue is the canonical Plugin surface for human-in-the-loop semantic/high-risk changes.

Required item anatomy:

```text
change type
risk / reason for review
current state
proposed state
rationale/evidence
source operation / transaction
available actions
```

Primary actions:

```text
Accept
Reject
Edit proposal
Open source/context
```

Batch actions:

```text
Approve safe
Reject selected
```

High-risk or conflicting changes cannot be hidden inside `Approve safe`.

## 21. Review item states

At minimum:

```text
pending
accepted
rejected
stale
conflict
failed
```

A proposal becomes `stale` when the underlying canonical content/version changed after proposal generation. Stale proposals require recomputation/review; do not apply old patches blindly.

## 22. Diff UX

Prefer the smallest semantic diff appropriate to the mutation:

```text
Property diff
Relation diff
AUTO-section diff
Text block diff
Full-file diff only when unavoidable
```

Property example:

```diff
- status: planned
+ status: active
```

Plugin renders change semantics and may expose raw diff/details for advanced users.

## 23. Approval semantics

Approval is bound to the reviewed operation/version.

After approval:

```text
Core rechecks optimistic concurrency
→ apply typed mutation
→ validate
→ transaction result
→ UI updates
```

If canonical state changed, approval does not silently authorize a new unseen patch.

## 24. Entity Inspector

P1 surface showing structured context for the active entity.

Sections may include:

```text
Type / status
Primary + related Areas
Projects / Goals
People / Organizations
Sources
Decisions
Related Knowledge
recent activity
```

Editing through Inspector calls typed Core mutations; it does not rewrite YAML directly.

## 25. Typed relations UI

Ideomy relations are presented semantically rather than as a flat backlink list.

Example:

```text
Contributes to
→ [[Goal]]

Supported by
→ [[Knowledge A]]
→ [[Source B]]

Decisions
→ [[Decision C]]
```

Native Obsidian backlinks remain available and complementary.

## 26. Project Context

When active context resolves to a Project, Plugin may show:

```text
Outcome
Current state
Goal / Area
Recent decisions
Relevant knowledge
Recent activity
Open questions
Review state
```

`Continue with Ideomy` / Ask commands use a Core-built Project Context Pack; Plugin does not assemble a hidden ad-hoc prompt itself.

## 27. System Health

Plugin health UI presents actionable exceptions, not a vanity score.

Example:

```text
Vault          Healthy
Core           Ready
Schema         2 issues
Index          Current
Review Queue   4
Sources        3 overdue
Projects       1 stale
```

Health states:

```text
Healthy
Attention
Degraded
Unavailable
```

The user can drill into diagnostics or run `ideomy doctor` where appropriate.

## 28. Notifications

Use transient Obsidian notices only for concise user-initiated feedback such as:

```text
Capture saved
Processing started/completed
Operation failed — open details
```

Do not use Notice spam for background health/Review Queue changes. Persistent states belong in Ideomy View.

## 29. Settings Tab

Recommended sections:

```text
General
Core connection
Vault / context
AI & Models
Privacy
UI
Diagnostics
Advanced
```

### General

```text
open Ideomy on startup? (default off)
ribbon visibility
preferred default Ideomy View mode
```

### Core connection

Read-mostly status/version/connection controls. Core install/update is not performed by the Plugin.

### AI & Models

Shows model profiles/provider status returned by Core. Provider credentials are never stored in Plugin/Vault settings.

### Privacy

Explains/defaults for context sharing and opens canonical Core/privacy configuration surfaces.

### Diagnostics

Core/version/transport state, safe copyable diagnostics, link to CLI `doctor` guidance.

## 30. Plugin settings data ownership

Plugin local data may store only lightweight UI/client configuration such as:

```text
preferred view mode
collapsed sections
non-secret connection hint
UI feature flags
```

Do not store:

```text
API keys
provider refresh tokens
full note content cache
canonical entity database
long-lived sensitive Core credential in Vault-synced settings
```

## 31. Core discovery

Setup establishes the machine-local Core installation and connection metadata.

Plugin discovers Core through an implementation-specific local connection hint managed by setup/Core contracts.

Requirements:

- no hard-coded assumption that Personal Vault lives beside Core repo;
- no public/LAN discovery broadcast;
- endpoint defaults to loopback/local IPC only;
- Plugin can distinguish `not installed`, `stopped`, `starting`, `healthy`, `incompatible`.

Exact OS storage/transport details remain Core platform-adapter implementation unless promoted to ADR.

## 32. Plugin ↔ Core protocol

All Plugin/Core communication uses a versioned semantic client (`CoreClient` concept), not scattered raw `fetch()` calls in UI components.

Minimum protocol operations:

```text
health / handshake
current system health
search / Ask request
entity/context fetch
capture/process request
Review Queue list/actions
transaction diff/status
operation progress/cancel
model/profile status
```

## 33. Handshake

Handshake returns at least:

```text
Core version
protocol version
supported protocol range/capabilities
configured Vault identity/fingerprint
schema/index summary
Core instance ID
```

Plugin supplies:

```text
Plugin version
supported protocol range
active Vault identity/fingerprint
platform
```

Core rejects Vault mismatch instead of serving a different configured Vault silently.

## 34. Protocol compatibility

States:

```text
compatible
plugin update required
Core update required
unsupported mismatch
```

Plugin presents exact remediation through supported update/bootstrap paths.

Do not attempt to “mostly work” across incompatible mutation contracts.

## 35. Local transport security

Initial desktop implementation may use loopback HTTP, but security is not delegated to “localhost is safe.”

Rules:

- bind loopback only by default;
- no LAN/public listener by default;
- health endpoint may expose minimal non-sensitive availability data;
- sensitive read/write operations require an authenticated local session;
- transport credentials/session material are machine-local, scoped and revocable;
- long-lived transport secrets must not be stored in canonical Vault Markdown or synced Plugin data;
- origin/request validation and Vault identity checks apply before sensitive operations.

A future local IPC/socket transport may replace HTTP without changing Plugin semantic contracts.

## 36. Operation model

Long-running Core work returns an `operation_id`.

Plugin can receive/poll semantic states:

```text
queued
running
waiting_review
completed
failed
cancelled
```

Progress payloads report actual stages where known:

```text
Resolving entities
Comparing sources
Validating changes
```

Not “AI is thinking.”

## 37. Streaming and cancellation

Transport may use SSE/WebSocket/another local event mechanism, but UI contract is stable:

- Ask may stream answer tokens/sections when provider supports it;
- structural operation progress is distinct from model text streaming;
- user can cancel cancellable operations;
- cancellation does not leave partial canonical writes;
- completed mutation transaction cannot be “cancelled”; use rollback/revert workflow where allowed.

## 38. Retry/idempotency

Plugin may automatically retry safe read requests on transient connection failures.

Mutation/operation requests require an idempotency key/operation identity supplied through Core contracts. UI must not blindly replay write requests after timeout.

## 39. Core unavailable / degraded mode

Plugin must load even when Core is absent/stopped.

Degraded UI:

```text
Ideomy Core is unavailable.

Available:
✓ Open Ideomy notes
✓ Offline Capture
✓ Open Settings / diagnostics

Unavailable:
— Ask
— Processing
— Review application
— System intelligence

[Diagnostics]
```

No Plugin crash or repeated intrusive notification loop.

## 40. Core restart/reconnect

Plugin automatically detects recoverable Core return and re-handshakes.

It must not require Obsidian restart for normal Core restart/update unless protocol/platform constraints explicitly require it.

## 41. Multiple windows and Vault identity

Every Core request is scoped to the active configured Vault identity.

MVP may support one configured Personal Vault per Core profile, but protocol fields must avoid accidental cross-Vault access and leave room for future multi-Vault registration.

Multiple Obsidian windows/leaves for the same Vault share Plugin/Core state through Plugin service layer rather than duplicate background workers.

## 42. Mobile V1

Plugin remains installable on mobile where Obsidian APIs permit.

Because desktop Ideomy Core is not reachable through mobile `localhost`, mobile V1 operates in **degraded/local-light mode** unless a future secure remote/local-mobile Core architecture is explicitly added.

Mobile V1 capabilities:

```text
Open Ideomy system notes/dashboards
Offline Capture to Inbox
Open entity/Area/Project notes through normal Obsidian navigation
lightweight Plugin view/status
show pending items for later Core processing
```

Core-dependent capabilities such as Ask, semantic processing, Review application and heavy indexing are disabled with clear explanation when no compatible Core is available.

## 43. Mobile implementation constraints

To preserve `isDesktopOnly: false`:

- do not import Node.js/Electron APIs;
- use Obsidian/Web APIs supported on mobile;
- use `Platform` for platform checks;
- do not assume filesystem adapter is desktop filesystem;
- mobile emulation + real-device tests are required before claiming feature parity.

## 44. Accessibility

Required baseline:

- full keyboard navigation on desktop;
- visible focus states;
- semantic controls/labels;
- accessible names for icon-only actions;
- no color-only status meaning;
- respect reduced motion where practical;
- status/progress announced appropriately without excessive live-region noise;
- contrast follows Ideomy Design System/WCAG baseline.

## 45. Theme integration

Use Obsidian CSS variables and semantic classes rather than hard-coded theme assumptions.

Rules:

- Light/Dark + representative community themes tested;
- avoid global CSS selectors that leak outside Ideomy surfaces;
- no bundled typography that replaces Obsidian globally;
- custom colors limited to semantic Ideomy accents/states and remain accessible;
- Plugin remains usable with custom CSS disabled.

## 46. Privacy

Plugin follows least-data transport:

- send Core entity/path pointers when Core can read canonical content itself;
- send selected/transient text only when the invoked workflow needs it;
- do not include unrelated open tabs/workspace state in model context;
- Plugin never sends content directly to cloud model providers; Core/Model Gateway owns provider routing;
- `local_only` / `denied` policy remains enforced by Core even if Plugin requests a workflow.

## 47. Telemetry

The Community Plugin contains **no client-side telemetry**.

If Core/service telemetry is ever introduced:

- it is governed separately by privacy/spec policy;
- plugin README/disclosures accurately state network/service usage;
- Personal Vault content is excluded by default;
- opt-in/required product telemetry semantics must be explicit.

## 48. Error model

UI groups errors by recoverability:

```text
Transient        retry
User action      show exact remediation
Compatibility    update Plugin/Core
Policy           explain restriction
Conflict         Review Queue / recompute
Core failure     diagnostics
Unexpected       stable error ID + safe details
```

Error UI should expose stable diagnostic/reference code from Core/CLI where available.

## 49. Empty states

Examples:

### Review Queue

```text
Nothing needs review.
```

### Ask without model route

```text
No model is configured for this request.
Configure AI & Models, connect a supported route, or continue using deterministic Ideomy features.
```

### Core unavailable

Explain unavailable vs failed; do not present empty data as “nothing found.”

## 50. Context menus

P1 contextual actions:

### Markdown editor selection

```text
Ask Ideomy about selection
Capture selection
Find related knowledge
Create Decision candidate
```

### File

```text
Process with Ideomy
Open Ideomy context
Find related knowledge
```

Context actions appear only when applicable; avoid menu bloat.

## 51. Workspace persistence

Ideomy View may persist normal workspace layout through Obsidian workspace mechanisms.

Do not persist sensitive query/answer content in workspace state merely to restore layout. Session content persistence requires an explicit product decision.

## 52. Bootstrap Plugin acceptance

Bootstrap Plugin is complete when:

- installs/enables through supported bootstrap path;
- loads without heavy work;
- exposes Plugin version/status;
- connects/handshakes with healthy Core;
- detects missing/stopped/incompatible Core;
- verifies active Vault identity;
- can open minimal Ideomy View;
- unload/reload cleans resources correctly;
- remains data-loss safe when removed;
- works without LLM configuration;
- mobile installation/degraded behavior does not crash if `isDesktopOnly: false`.

## 53. Product Plugin MVP acceptance

Product Plugin MVP is complete when:

- Ask returns provenance-linked answer through Core;
- Capture works with Core and offline append-only fallback;
- Process current note shows structured result categories;
- Review Queue supports accept/reject/edit/open-context;
- semantic diff is visible before reviewed mutation apply;
- System Health reflects Core state accurately;
- Settings show Core/model/privacy state without storing provider secrets;
- Core restart/reconnect requires no full Obsidian restart in normal case;
- keyboard/accessibility baseline passes;
- representative Light/Dark/theme tests pass;
- Plugin can be disabled/uninstalled without canonical data loss.

## 54. Performance Definition of Done

Before public beta:

- Plugin startup regression measured;
- no Vault-wide work in `onload`;
- no duplicate Core event subscriptions after reload;
- primary view rendering does not block Obsidian editor;
- operations over large Vaults execute in Core, not Plugin main thread;
- connection loss does not create retry storm;
- memory/listener leaks checked across plugin reload and view open/close cycles.

## 55. Security Definition of Done

Before write-enabled Product Plugin:

- local transport authenticated for sensitive operations;
- Vault identity mismatch rejected;
- mutation requests use typed Core contracts;
- write retries are idempotent/operation-bound;
- Review approval binds to reviewed version/patch;
- provider secrets absent from Plugin data/Vault;
- external/untrusted note text cannot alter Plugin/Core policy;
- client-side telemetry absent;
- Community directory disclosures are complete.

## 56. Testing strategy

### Unit

```text
view state reducers/controllers
command predicates
settings validation
CoreClient protocol parsing
error/degraded-state mapping
Review Queue action logic
```

### Contract

```text
Plugin ↔ mock Core handshake
protocol compatibility
operation lifecycle
Review mutations
stream/cancel/reconnect
Vault identity mismatch
```

### Integration

```text
synthetic Obsidian test Vault
Bootstrap Plugin install/enable
Core absent/stopped/healthy/incompatible
active-note context
capture
Review Queue
settings
```

### Manual matrix

```text
macOS desktop
Windows desktop
Linux desktop
Android mobile
supported iOS versions
Light/Dark
representative community themes
keyboard-only flow
```

No test/eval uses production Personal Vault content.

## 57. Plugin-specific eval gates

Release gates include:

```text
startup_load
core_handshake
protocol_compatibility
core_offline_degraded
capture_offline_append_only
active_context_scoping
ask_provenance
review_stale_conflict
approval_version_binding
plugin_reload_cleanup
privacy_payload_minimization
mobile_no_node_imports
settings_secret_redaction
```

## 58. Repository placement

Within the software repository, prefer an explicit app/package boundary, e.g. conceptually:

```text
apps/
  obsidian-plugin/
  cli/
  core/

packages/
  contracts/
  core-client/
  ...
```

Repository placement is canonical in `22_ENGINEERING_FOUNDATION`: `apps/obsidian-plugin` consumes shared `packages/core-client` / `packages/contracts` and UI-safe packages only. Plugin code must not import Core server internals directly.

## 59. Dependency rules

Allowed direction:

```text
obsidian-plugin
→ core-client / contracts / shared UI-safe packages

core
→ contracts / domain packages
```

Forbidden:

```text
obsidian-plugin → core server implementation
core → Obsidian API
shared contracts → Obsidian API
```

This preserves testability and a future non-Obsidian client path.

## 60. Product milestone sequence

```text
P0 Bootstrap Plugin
  → load / status / handshake

P1 Foundation Plugin
  → primary view / commands / Capture / System Health

P2 Intelligence Plugin
  → Ask / Process current note / current Context

P3 Review Plugin
  → Review Queue / Diff / Approvals / Entity Inspector

P4 Refinement
  → contextual menus / Project Context / Weekly Review / mobile polish
```

Do not block Core/Bootstrap milestones on P2–P4 UI.

## 61. Non-goals

V1 Plugin does not become:

```text
standalone editor
full replacement for native Obsidian navigation
canonical database
vector database
model provider client bypassing Core
MCP server
background daemon
sync engine
secret manager
telemetry SDK host
```

## 62. Definition of Done

The Plugin contract is considered satisfied for V1 when:

1. architecture boundaries are mechanically respected;
2. Bootstrap Plugin passes M0 integration;
3. Product Plugin provides Ask/Capture/Review/System Health through typed Core contracts;
4. offline/degraded behavior is explicit and safe;
5. mobile installation does not crash and offers documented reduced capability;
6. accessibility/theme/load-time gates pass;
7. plugin removal does not remove or corrupt user knowledge;
8. Community directory policy constraints are satisfied;
9. Core remains independently operable through CLI/MCP;
10. no user needs to understand Plugin/Core internals during normal use.


## Readiness dependency

Plugin pairing/discovery/request schemas are no longer implementation-specific: the V1 baseline is fixed in `21_CORE_PROTOCOL`. Repository placement/dependency/toolchain baseline is fixed in `22_ENGINEERING_FOUNDATION`.

## 62. Browser capture boundary

The Obsidian Plugin is not responsible for browser extraction. V1 browser capture is provided by official Obsidian Web Clipper templates writing to `01 Inbox/Web`.

Plugin may expose Inbox/processing status and actions after the capture reaches the Vault. It must not duplicate Web Clipper browser-extension functionality.

---

<!-- SOURCE: 20_VAULT_IO_AND_SCHEMA__created-10-10-26_15-41-48__updated-12-10-26_16-30-30__v0.11.0.md -->

# Vault I/O, Identity & Schema Contract


## 1. Purpose

This document is the canonical low-level contract for reading, identifying, validating and safely mutating a Personal Vault.

It exists so Core/parser/mutation code cannot invent file semantics ad hoc.

## 2. Canonical file model

A Markdown file is represented as:

```text
raw bytes
→ encoding/newline metadata
→ optional YAML frontmatter slice
→ Markdown body slice
→ extracted links/headings/AUTO blocks
```

UTF-8 is the supported canonical encoding for managed Ideomy Markdown. UTF-8 BOM is accepted/read and preserved unless an explicit normalization migration is approved.

Line endings are preserved per file (`LF` or `CRLF`) for ordinary typed mutations.

## 3. Managed vs unmanaged

### Managed Entity

Required markers:

```yaml
ideomy_schema: 1
id: prj_...
type: project
```

Managed Entities validate against `schemas/entities/<type>.schema.json` after logical-property normalization.

### Unmanaged note

Any `.md` without a valid managed marker remains an ordinary document:

- index/search allowed;
- links/context extraction allowed;
- full read allowed subject to privacy policy;
- no Entity-specific status transition assumed;
- no automatic schema rewrite/adoption.

Adoption is an explicit typed operation with preview/diff.

## 4. Stable IDs

ID format:

```text
<prefix>_<26-character Crockford Base32 ULID>
```

Properties:

- immutable;
- generated once;
- case-normalized to uppercase ULID payload;
- never derived from filename/path/title;
- duplicate ID = hard integrity error;
- merge/split creates explicit identity history; never recycle deleted IDs.

## 5. Vault identity

Each configured Vault receives a machine-generated `vault_id` outside ordinary note metadata and a fingerprint derived from the resolved root identity/config.

Core protocol always scopes requests to `vault_id` + fingerprint. Moving the entire Vault may update path metadata without changing `vault_id` after explicit rebind/validation.

## 6. Property normalization

Ideomy schemas define **logical property names**.

New Vault physical keys equal logical keys. Existing Vault profiles may define explicit mapping:

```json
{"status":"ideomy_status"}
```

Rules:

- mappings are machine-local/profile configuration plus portable non-secret declaration where appropriate;
- two logical properties cannot map to the same physical key;
- mapping changes require migration preview;
- skills/tools never address physical mapped names directly.

## 7. Frontmatter parsing

Baseline implementation uses a YAML parser capable of document/node preservation (engineering baseline: `yaml` Document API).

Required behavior:

- frontmatter only when file begins with valid `---` opening delimiter;
- preserve unknown user properties;
- preserve key order;
- preserve comments where parser supports them;
- duplicate YAML keys produce diagnostic and block managed writes;
- YAML aliases/anchors may be read but Ideomy-owned properties must resolve to ordinary scalar/list values;
- malformed YAML makes the note read-only to typed mutation until user/repair resolves it.

No ordinary Ideomy operation silently “fixes” unrelated YAML.

## 8. Round-trip contract

For a property-only mutation:

```text
Markdown body bytes outside frontmatter MUST remain byte-identical.
Unknown frontmatter keys MUST remain semantically intact.
Untouched Ideomy/user properties MUST not be reordered intentionally.
Comments MUST be preserved to the supported parser contract.
```

Formatting normalization of the touched YAML node is allowed only when unavoidable and must be visible in diff.

Whole-document regeneration is forbidden for ordinary metadata mutation.

## 9. Markdown parsing

Core extracts at minimum:

```text
headings
wikilinks
embeds
standard Markdown links
AUTO section markers
code-fence boundaries
```

A Markdown AST parser may be used for read/index operations. Writes remain surgical and do not serialize the full AST unless a future ADR explicitly changes the contract.

## 10. Wikilinks and relation resolution

Vault-facing links may use:

```text
[[Title]]
[[path/Title]]
[[Title|Alias]]
```

Core resolution order:

```text
exact path
→ Obsidian-like unique basename/title candidate
→ alias candidate
→ ambiguous unresolved relation
```

Managed relation edges store resolved stable IDs in derived index. Ambiguity is never silently resolved by semantic similarity for canonical relations.

## 11. Rename / move / delete

### Rename/move

Stable Entity ID remains unchanged. Index updates path/title/aliases. Ideomy does not rewrite every wikilink unless explicit Obsidian-supported behavior/migration is invoked.

### Delete

Filesystem deletion removes the active entity from derived index after watcher confirmation. Transaction/audit history may retain tombstone metadata sufficient for recovery, not a hidden canonical copy.

## 12. Paths and symlinks

Before any write:

- resolve Vault root realpath;
- resolve target parent/target safely;
- reject path traversal outside Vault root;
- symlink/junction escape outside configured Vault is rejected by default;
- system/plugin directories can have explicit allow/deny rules;
- attachments follow the same traversal policy.

## 13. AUTO sections

Agent-owned generated body blocks use:

```html
<!-- BEGIN AUTO:name -->
...
<!-- END AUTO:name -->
```

Rules:

- marker names unique per note;
- missing/mismatched/duplicate marker = diagnostic, no blind rewrite;
- replacement touches only marker payload and preserves outer body;
- user-owned text outside markers is immutable unless an explicitly reviewed operation targets it.

## 14. Hashes / optimistic concurrency

Every mutation plan records:

```text
file path
precondition content hash
optional parsed entity version
intended operations
```

At apply time hashes are rechecked. Mismatch → conflict/recompute/review; never last-write-wins silently.

Hash is over raw file bytes.

## 15. Atomic file write

For each file:

```text
render candidate bytes
→ write sibling temp file
→ fsync/flush where supported
→ validate candidate parse/schema
→ atomic replace/rename
→ post-write reread/hash
```

Platform adapter defines exact durability primitive. Original snapshot remains available until transaction commit/recovery window.

## 16. Multi-file transactions

Filesystem cannot provide true cross-file atomic commit. Ideomy therefore defines **recoverable transaction atomicity**:

```text
PLANNED
→ SNAPSHOTTED
→ APPLYING
→ VALIDATING
→ COMMITTED
```

Failure during APPLYING/VALIDATING → `RECOVERY_REQUIRED` or automatic rollback when safe.

Transaction journal contains file hashes, snapshots/backup references and completed step markers. Core startup recovery must detect incomplete transactions before accepting new writes.

## 17. Transaction state machine

```text
planned
snapshotted
applying
validating
waiting_review   # when plan generated before apply
committed
rolled_back
recovery_required
failed
```

Transaction IDs use ULID/UUID-class opaque identifiers and are never reused.

## 18. Snapshot retention

Default recovery snapshots are local machine state, not canonical knowledge and not model context.

Retention is bounded by configurable count/age/size policy. A snapshot containing sensitive Vault content inherits that sensitivity and is never uploaded through telemetry.

## 19. File watcher

Baseline implementation uses a cross-platform watcher abstraction (Alpha implementation may use `chokidar`).

Watcher requirements:

- debounce burst writes;
- track create/change/unlink/rename-like sequences;
- suppress/recognize Core's own committed writes using transaction/hash correlation;
- never assume event ordering alone is truth;
- reread actual filesystem state;
- external edit during transaction triggers hash conflict.

## 20. Obsidian Sync / external sync

Sync is treated as an external writer.

Rules:

- no lock assumption across devices;
- every local Core write still uses precondition hash;
- conflict/duplicate files are indexed as distinct files until user resolves them;
- external deletion/rename is reconciled from observed filesystem state;
- Core never overwrites a changed file solely because a queued plan is older.

## 21. Schema versioning

Managed note property:

```yaml
ideomy_schema: 1
```

Schema migrations are explicit:

```text
detect old version
→ plan per-note changes
→ preview/dry run
→ snapshot
→ apply typed migrations
→ validate
→ diff/report
```

No silent bulk migration during ordinary read/index.

## 22. Validation severity

```text
ERROR   blocks managed mutation/index-as-valid entity
WARNING entity usable but needs review
INFO    advisory/system health
```

Examples:

```text
duplicate ID                 ERROR
invalid managed type/status  ERROR
missing optional source      WARNING
project target_date missing  INFO
```

## 23. Schema artifacts

Canonical machine files:

```text
schemas/base.schema.json
schemas/registry.json
schemas/relationships.json
schemas/entities/*.schema.json
```

Schemas validate normalized managed frontmatter, not arbitrary unmanaged notes.

## 24. Vault template / fixture contract

`vault-template/` is distributable starter content and may contain placeholders only where setup fills them.

`fixtures/test-vault/` is synthetic and intentionally includes:

```text
valid managed entities
unmanaged note
invalid schema case
ambiguous duplicate-name case
local_only/denied case
prompt-injection source text
```

Fixtures are executable test inputs, not examples to copy into a production Vault.

## 25. Definition of Done

Vault I/O foundation is complete when:

- all machine schemas validate themselves;
- all valid fixtures pass and expected-invalid fixtures fail;
- duplicate IDs detected;
- rename/move preserves ID;
- unknown fields/comments/body preservation golden tests pass;
- symlink/path escape rejected;
- own-watcher writes do not loop;
- concurrent external edit causes conflict;
- crash-recovery golden transaction succeeds;
- no real Personal Vault content is required.

---

<!-- SOURCE: 21_CORE_PROTOCOL__created-10-10-26_15-41-48__updated-12-10-26_16-30-30__v0.11.0.md -->

# Core Local Protocol & Client Contract


## 1. Purpose

This document is the canonical V1 contract used by Ideomy Plugin and CLI to communicate with Ideomy Core. UI clients use `CoreClient` types generated/shared from these contracts.

## 2. V1 transport

Desktop V1:

```text
HTTP/1.1 JSON over loopback (127.0.0.1 / ::1)
API prefix: /v1
SSE for operation events / Ask streaming where required
```

No LAN/public bind by default. Future Unix-domain/named-pipe transport may replace HTTP behind `CoreClient` without changing semantic request schemas.

## 3. Core discovery

Core writes a machine-local discovery record in platform config/state directory, never in the Personal Vault:

```json
{
  "instance_id": "core_...",
  "protocol": 1,
  "port": 18421,
  "pid": 12345,
  "started_at": "...",
  "vault_id": "vault_..."
}
```

The port may be dynamic. Clients must not hard-code a port.

Discovery record is non-secret and permission-restricted where supported. It never contains a bearer/session secret.

## 4. Client identities

V1 recognizes:

```text
plugin
cli
mcp-host-adapter (internal Core path, not local UI client)
```

Every sensitive request is bound to an authenticated client session and `vault_id`.

## 5. Plugin pairing/authentication

Goal: avoid storing a long-lived sensitive bearer secret in Vault-synced Plugin data.

Baseline pairing:

1. Plugin generates a WebCrypto ECDSA P-256 keypair.
2. Private key is non-extractable and persisted in local browser storage/IndexedDB abstraction, not Vault Markdown/plugin synced settings.
3. During `ideomy setup`, Core opens a short-lived pairing window.
4. Bootstrap may place a one-time non-reusable pairing hint/token in plugin-local bootstrap state; it is deleted after success.
5. Plugin sends public key + Vault fingerprint + bootstrap proof to `/v1/pair/request`.
6. Core records public key after setup-authorized pairing.
7. On later launches Core issues a nonce challenge; Plugin signs it; Core verifies registered key and issues short-lived session bearer.
8. Session token remains memory-only and expires/revokes on policy/Core restart timeout.

If platform storage cannot persist a non-extractable key, Plugin re-pairs through explicit setup/repair; it must not downgrade to an unprotected permanent token in Vault.

## 6. CLI authentication

CLI is installed/administered by the same user account and obtains Core admin/session material from the machine-local credential/state adapter. Secrets are permission-restricted/credential-store-backed and never printed by default.

CLI and Plugin sessions are distinct and revocable independently.

## 7. Handshake

### Request

```text
client type/version
protocol min/max
vault_id/fingerprint
platform
client instance id
capability request
```

### Response

```text
Core version
Core instance id
protocol selected
protocol/capability set
Vault identity/fingerprint
schema/index status
model/agent availability summary
session expiry metadata
```

Vault mismatch is a hard error for context/data operations.

## 8. Protocol compatibility

Protocol major `1` is backwards-compatible within explicitly supported minor capability changes.

States:

```text
compatible
client_update_required
core_update_required
unsupported
```

Mutation operations are disabled on incompatible contracts even if read-only health can still report remediation.

## 9. HTTP conventions

Headers:

```text
Authorization: Bearer <session-token>     # sensitive endpoints
X-Ideomy-Protocol: 1
X-Ideomy-Client: plugin|cli
X-Ideomy-Request-Id: <opaque id>
Idempotency-Key: <opaque id>              # write/start-operation endpoints
```

JSON content type uses UTF-8.

## 10. Endpoint classes

### Unauthenticated/minimal

```text
GET /v1/health
POST /v1/pair/request      # only pairing semantics, rate limited
```

Health exposes no note content, paths beyond safe diagnostics or sensitive config.

### Authenticated reads

```text
POST /v1/handshake
GET  /v1/system-health
POST /v1/search
GET  /v1/entities/:id
POST /v1/context
GET  /v1/review-queue
GET  /v1/transactions/:id
GET  /v1/models/status
```

### Authenticated operations/writes

```text
POST /v1/capture
POST /v1/process
POST /v1/agent/run
POST /v1/review/:id/accept
POST /v1/review/:id/reject
POST /v1/review/:id/edit
POST /v1/transactions/:id/rollback
POST /v1/operations/:id/cancel
```

Exact request/response schemas are in `contracts/protocol/v1/` and shared Types/Zod contracts in implementation.

## 11. Error envelope

Every non-success application response uses stable structure:

```json
{
  "ok": false,
  "error": {
    "code": "CORE-004",
    "category": "core",
    "message": "Human-safe summary",
    "retryable": false,
    "request_id": "req_...",
    "details": {}
  }
}
```

Sensitive internals/stack traces never cross normal client boundary.

## 12. Operation model

Long work returns:

```json
{"operation_id":"op_...","state":"queued"}
```

States:

```text
queued
running
waiting_review
completed
failed
cancelled
```

Terminal state is persisted sufficiently for client reconnect/reload during a bounded retention window.

## 13. Events / SSE

```text
GET /v1/operations/:id/events
```

Event envelope:

```text
event_id
operation_id
sequence
kind
stage
progress? 
payload?
timestamp
```

Kinds include:

```text
state
progress
output_delta
review_required
completed
failed
```

Clients deduplicate by `(operation_id, sequence)`.

## 14. Timeouts

Default client budgets:

```text
health/handshake       1–2 s local target
ordinary read          5 s
operation start        10 s
SSE idle heartbeat     <= 30 s
```

Long computation does not hold a single ordinary HTTP request; it returns operation ID.

## 15. Retry / idempotency

Safe reads may retry transient transport errors with bounded backoff.

Writes/start-operation endpoints require `Idempotency-Key`. Core stores outcome mapping for a bounded period so client timeout/retry cannot duplicate capture/mutation.

No client blindly retries an unknown write after timeout without idempotency identity.

## 16. Cancellation

Cancellation is best-effort for cancellable running operations. It cannot undo committed canonical mutation; use transaction rollback workflow instead.

Core guarantees cancellation never intentionally leaves partial unjournaled canonical writes.

## 17. Vault binding

Every request/session is scoped to a configured `vault_id`. The client includes active Vault fingerprint during handshake. Core never serves another configured Vault silently.

MVP supports one active Personal Vault per Core profile while protocol fields remain multi-Vault-ready.

## 18. Context minimization

Plugin normally sends:

```text
entity/file pointer
selection text only when user explicitly scopes to selection
requested action
UI context flags
```

Core reads canonical note content itself. Plugin does not mirror full Vault content across transport unnecessarily.

## 19. Protocol schemas

Normative machine files:

```text
contracts/protocol/v1/handshake-request.schema.json
contracts/protocol/v1/handshake-response.schema.json
contracts/protocol/v1/error-envelope.schema.json
contracts/protocol/v1/operation.schema.json
contracts/protocol/v1/status.schema.json
contracts/protocol/v1/review-item.schema.json
```

Examples live in `contracts/examples/` and must validate against these schemas.

## 20. Security tests

Required:

```text
unauthenticated sensitive read rejected
invalid/expired session rejected
wrong Vault fingerprint rejected
pairing window closed/replay rejected
malicious Origin/request rejected where applicable
idempotency replay returns original result
session revocation effective
no secret in health/log/diff payload
```

## 21. Definition of Done

Core protocol v1 is implementation-ready when:

- protocol JSON Schemas validate;
- examples validate;
- mock CoreClient contract tests pass;
- Plugin and CLI share generated/shared types, not duplicated hand-written DTOs;
- discovery works without hard-coded port;
- Plugin pairing survives normal restart without Vault-stored secret;
- protocol mismatch produces deterministic remediation;
- auth/Vault mismatch critical eval failures = 0.

---

<!-- SOURCE: 22_ENGINEERING_FOUNDATION__created-10-10-26_15-41-48__updated-12-10-26_16-30-30__v0.11.0.md -->

# Engineering Foundation & Repository Contract


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
