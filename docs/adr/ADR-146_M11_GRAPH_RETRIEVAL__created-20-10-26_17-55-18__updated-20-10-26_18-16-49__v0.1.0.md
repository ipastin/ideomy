---
title: "ADR-146 — Bounded M1.1 graph retrieval and Project Context Pack"
created: "20-10-26 17-55-18"
updated: "20-10-26 18-16-49"
version: "0.1.0"
status: "accepted"
commit: "feat(retrieval): add bounded project context pack"
---

# ADR-146 — Bounded M1.1 graph retrieval and Project Context Pack

Created: 20-10-26 17-55-18
Updated: 20-10-26 18-16-49
Version: 0.1.0
Change: `feat(retrieval): add bounded project context pack`

## Context

M1 stores managed relations and FTS, but does not expose exact lookup, graph traversal or Context Packs. ADR-040 calls for a graph derived from typed Properties and wikilinks. ADR-145 governs canonical typed-relation resolution; it explicitly leaves Graph and Context Packs outside its decision. M1.1 needs a small read-only package slice before Core protocol exposure or M1.2 mutations.

## Decision

- Exact query lookup checks an immutable managed ID first with exact case-sensitive equality. Title, basename and alias candidates use Unicode NFC plus lowercase, without transliteration or diacritic removal. Managed and unmanaged notes share one candidate set. More than one distinct note is `ambiguous`; candidates are ordered by path. This query behavior does not change ADR-145's tiered, case-sensitive canonical relation resolution.
- The derived index stores non-embed body wikilinks. A wiki target resolves by exact path, then unique basename/title, then unique alias across managed and unmanaged notes; ambiguity stays unresolved. It has no canonical target-type filter. A unique managed target is identified by ID; a unique unmanaged target remains a path/hash pointer and is never adopted. Wiki edges remain distinct from typed Properties edges. External Markdown links and embeds are not traversal edges.
- Project traversal takes one incoming and outgoing step over resolved typed and wiki edges, deduplicates repeated edges and returns at most 50 nodes and 100 edges. Its ordering is deterministic and it reports truncation. Unresolved references are stored for diagnostics but never traversed. The index remains disposable; the schema migration and revision marker force prior cached data to rebuild without Vault Markdown writes.
- A Project Context Pack is a transient runtime value with the nine sections named in `04_KNOWLEDGE_INTELLIGENCE`. Missing sections are empty. It uses deterministic metadata, headings and source excerpts, never generated factual text. At most 10 items and 12,000 Unicode code points of item text are included; truncation and omitted item count are explicit. Each item is marked as untrusted data and cites a stable managed ID or path plus raw hash. The manifest carries the Vault fingerprint and index revision. The caller supplies the expected current revision; this package does not rescan the Vault to establish freshness.
- The Pack requires an `agent_context` purpose and matching Vault fingerprint/revision. Only `agent_access=allowed` with `sensitivity=public|internal|private` may contribute text. Unknown, `restricted`, `local_only`, `denied` and `sensitive` are excluded. This is a bounded first consumer profile, not a change to canonical content or a claim that other profiles are forbidden forever. Existing direct local retrieval seeds, including `local_only`, remain separate from Pack eligibility.
- Candidate ranking uses a root-title FTS match as a relevance boost, then the accepted Decision / evergreen Knowledge / verified Record / Project / Source / Meeting / Journal authority prior, with deterministic path ties. Dated Decision and activity items sort newest first within their sections. The prior is not absolute.

## Alternatives considered

1. Case-sensitive tiered user lookup, outgoing-only traversal and sparse Pack: less code, but it misses incoming Project knowledge and conceals title/alias collisions across tiers.
2. Full restricted/local-only policy capabilities and Core endpoints in this slice: more coverage, but an index package cannot authenticate a grant or approved local backend. That requires separate protocol and privacy decisions.

## Consequences

`@ideomy/index`, `@ideomy/graph` and `@ideomy/retrieval` gain typed package APIs and synthetic goldens. No Core endpoint, Plugin, model route, M1.2 transaction or canonical Vault mutation is introduced. Future model-facing callers must validate their own authenticated Vault-scoped authority and expected index revision before using this package result.
