---
title: "Ideomy Obsidian Plugin — Product & Technical Contract"
created: "10-10-26 14-56-08"
updated: "15-10-26 14-53-19"
version: "0.11.1"
status: "accepted"
commit: "docs(bootstrap): separate Plugin P0 acceptance"
---

# Ideomy Obsidian Plugin — Product & Technical Contract

Created: 10-10-26 14-56-08  
Updated: 15-10-26 14-53-19  
Version: 0.11.1  
Change: `docs(bootstrap): separate Plugin P0 acceptance`

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

## 52. Bootstrap Plugin P0 acceptance — M0.4

Bootstrap Plugin is complete when:

- installs/enables through supported bootstrap path;
- loads without heavy work;
- exposes Plugin version/status;
- authenticates and handshakes with a running compatible Core;
- detects missing/stopped/incompatible Core;
- verifies active Vault identity;
- can open minimal Ideomy View;
- unload/reload cleans resources correctly;
- remains data-loss safe when removed;
- works without LLM configuration;
- mobile installation/degraded behavior does not crash if `isDesktopOnly: false`.

Acceptance includes a real macOS Obsidian/Core smoke test using a synthetic Vault. This Plugin integration gate is separate from full Bootstrap Foundation `doctor Healthy`, which also requires the initial deterministic index and is completed in M0.5.

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
