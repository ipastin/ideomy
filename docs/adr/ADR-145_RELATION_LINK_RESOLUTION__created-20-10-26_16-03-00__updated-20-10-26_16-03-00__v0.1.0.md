---
title: "ADR-145 — Resolve relation links before target-type filtering"
created: "20-10-26 16-03-00"
updated: "20-10-26 16-03-00"
version: "0.1.0"
status: "accepted"
commit: "docs(spec): define fail-closed relation resolution"
---

# ADR-145 — Resolve relation links before target-type filtering

Created: 20-10-26 16-03-00
Updated: 20-10-26 16-03-00
Version: 0.1.0
Change: `docs(spec): define fail-closed relation resolution`

## Context

`20_VAULT_IO_AND_SCHEMA` orders exact path, basename/title and alias resolution. `schemas/relationships.json` limits the allowed target entity type, but did not say whether filtering by that type may hide a same-name note before ambiguity is checked. M1 previously resolved an Area even when a Person had the same title. Unmanaged notes are searchable and linkable, but their role in relation ambiguity was also unstated. A false resolved edge is unsafe because it can silently connect canonical knowledge to the wrong Entity.

## Decision

For each canonical managed relation, search exact path, then basename/title, then alias. Stop at the first tier with any matching Vault notes. At that tier, multiple distinct notes are `ambiguous` even if only one is a managed Entity of the allowed target type. Managed and unmanaged notes participate in candidate matching. A unique unmanaged note or managed Entity of the wrong type is unresolved (`missing` in the M1 index), with no search at a lower tier. Only a unique managed Entity of the allowed target type resolves to a stable ID. `schemas/relationships.json` remains the target-type authority; it is checked after uniqueness.

Unmanaged frontmatter `aliases` participate only when represented as a list containing the exact reference string. This is candidate matching, not adoption or typed validation. Invalid notes prevent a valid index rebuild under the existing schema diagnostics.

## Alternatives considered

1. Filter by allowed target type before checking uniqueness. This keeps more edges resolved but can hide a visible same-name Person or unmanaged note and create a false canonical relation.
2. Count all notes only for basename/title, leaving alias matching managed-only. This narrows changes but gives inconsistent ambiguity behavior across the documented resolution tiers.
3. Resolve each tier among all valid notes before type filtering (**chosen**). More edges may become unresolved until links are disambiguated by path, but canonical edges fail closed.

## Consequences

The derived SQLite index revision includes a relation-resolution version, so an unchanged Vault built under the previous semantics becomes stale and is rebuilt. SQLite table schema and canonical Markdown do not change. Bootstrap `setup/status/doctor` must report stale until rebuild and current after it. Synthetic tests cover cross-type and unmanaged basename/title/alias collisions, exact-path priority, wrong-type/no-fallback, and rebuild of a prior cached edge without Markdown changes. Graph/Context Packs and Vault writes remain outside this decision.
