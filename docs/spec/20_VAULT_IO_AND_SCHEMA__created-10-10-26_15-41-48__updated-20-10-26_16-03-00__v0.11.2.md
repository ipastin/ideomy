---
title: "Vault I/O, Identity & Schema Contract"
created: "10-10-26 15-41-48"
updated: "20-10-26 16-03-00"
version: "0.11.2"
status: "accepted"
commit: "docs(spec): define fail-closed relation resolution"
---

# Vault I/O, Identity & Schema Contract

Created: 10-10-26 15-41-48
Updated: 20-10-26 16-03-00
Version: 0.11.2
Change: `docs(spec): define fail-closed relation resolution`

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

At each tier, find matching managed and unmanaged Vault notes before applying the allowed target type from `schemas/relationships.json`. More than one distinct match is ambiguous even when only one has the allowed type. A unique unmanaged or wrong-type match remains unresolved and does not fall through to a lower tier. Only a unique managed Entity of the allowed type yields an ID-based edge. Unmanaged `aliases` participate when their frontmatter provides a list containing the reference; this does not adopt or validate them as Entities. See ADR-145.

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
