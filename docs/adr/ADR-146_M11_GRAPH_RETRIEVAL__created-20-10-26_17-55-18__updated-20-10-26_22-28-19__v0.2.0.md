---
title: "ADR-146 — Bounded M1.1 graph retrieval and Project Context Pack"
created: "20-10-26 17-55-18"
updated: "20-10-26 22-28-19"
version: "0.2.0"
status: "accepted"
commit: "feat(retrieval): add scoped retrieval and executable evals"
---

# ADR-146 — Bounded M1.1 graph retrieval and Project Context Pack

Created: 20-10-26 17-55-18
Updated: 20-10-26 22-28-19
Version: 0.2.0
Change: `feat(retrieval): add scoped retrieval and executable evals`

## Context

M1 stores managed relations and FTS, but does not expose exact lookup, graph traversal or Context Packs. ADR-040 calls for a graph derived from typed Properties and wikilinks. ADR-145 governs canonical typed-relation resolution; it explicitly leaves Graph and Context Packs outside its decision. M1.1 needs a small read-only package slice before Core protocol exposure or M1.2 mutations.

## Decision

- Exact query lookup checks an immutable managed ID first with exact case-sensitive equality. Title, basename and alias candidates use Unicode NFC plus lowercase, without transliteration or diacritic removal. Managed and unmanaged notes share one candidate set. More than one distinct note is `ambiguous`; candidates are ordered by path. This query behavior does not change ADR-145's tiered, case-sensitive canonical relation resolution.
- The derived index stores non-embed body wikilinks. A wiki target resolves by exact path, then unique basename/title, then unique alias across managed and unmanaged notes; ambiguity stays unresolved. It has no canonical target-type filter. A unique managed target is identified by ID; a unique unmanaged target remains a path/hash pointer and is never adopted. Wiki edges remain distinct from typed Properties edges. External Markdown links and embeds are not traversal edges.
- Project traversal takes one incoming and outgoing step over resolved typed and wiki edges, deduplicates repeated edges and returns at most 50 nodes and 100 edges. Its ordering is deterministic and it reports truncation. The Pack applies access and supported-section eligibility before these bounds, so excluded nodes do not displace eligible context. Unresolved references are stored for diagnostics but never traversed. The index remains disposable; the schema migration and revision marker force prior cached data to rebuild without Vault Markdown writes.
- A Project Context Pack is a transient runtime value with the nine sections named in `04_KNOWLEDGE_INTELLIGENCE`. Missing sections are empty. It uses deterministic metadata, headings and source excerpts, never generated factual text. At most 10 items and 12,000 Unicode code points of item text are included; truncation and omitted item count are explicit. The count includes distinct eligible notes lost at the graph bound plus Pack items omitted by its own budget; excluded notes are never counted. Each item is marked as untrusted data and cites a stable managed ID or path plus raw hash. The manifest carries the Vault fingerprint and index revision. The caller supplies the expected current revision; this package does not rescan the Vault to establish freshness.
- The Pack requires an `agent_context` purpose and matching Vault fingerprint/revision. Only `agent_access=allowed` with `sensitivity=public|internal|private` may contribute text. Unknown, `restricted`, `local_only`, `denied` and `sensitive` are excluded. This is a bounded first consumer profile, not a change to canonical content or a claim that other profiles are forbidden forever. Existing direct local retrieval seeds, including `local_only`, remain separate from Pack eligibility.
- Candidate ranking uses a root-title FTS match as a relevance boost, then the accepted Decision / evergreen Knowledge / verified Record / Project / Source / Meeting / Journal authority prior, with deterministic path ties. Allowed Source items enter Relevant Knowledge and allowed Journal items enter Recent Activity. Dated Decision and activity items sort newest first within their sections. The prior is not absolute.

### Remaining M1.1 scoped retrieval and eval decision

- **A3 — Area scope.** A resolved managed `primary_area` typed edge places a note in the first tier; a resolved `related_areas` typed edge places it in the second tier, with `scopeReason` on every result. Primary wins if both edges exist. Wikilinks, path names and text mentions never assign Area. Unmanaged notes remain available only in unscoped discovery and cannot acquire Area by inference.
- **U1 — unmanaged discovery.** Unmanaged notes may appear in unscoped `local_discovery` with path, raw hash, title and provenance. They are never adopted or granted `agent_context` by indexing.
- **R2 — raw and processed source identity.** `ideomy_capture: web-v1` together with `capture_type: web` and `capture_status: inbox` identifies a raw Web Capture regardless of path. Other raw Inbox classification requires an explicitly supplied, relative confirmed Inbox root and a path beneath it; a path merely containing “Inbox” is insufficient. An unmanaged note outside that root remains ordinary unscoped discovery. A managed Source is a processed Source only for `type=source,status=processed`; an unprocessed Source outside a confirmed Inbox root is not returned. These are derived classifications, not canonical note mutations.
- **Q2 — lexical retrieval.** Unicode letter/number terms are normalized to NFC and lowercase. FTS requires all terms first; if no policy-eligible hit remains, it retries with OR. Rank within a scope tier by deterministic lexical term matches, then a smaller authority prior, then path. Raw Inbox and Web Capture have a lower prior than Journal and processed Source even when their managed type is Source. The authority prior cannot overrule a stronger lexical match. The existing literal phrase `search()` API and exact lookup semantics remain unchanged.
- **P2 — purpose profiles.** `agent_context` includes only managed `agent_access=allowed` and supported sensitivity, and may return bounded note text marked `untrusted_data`. `local_discovery` returns identity/provenance metadata only, including `local_only`, restricted and unmanaged notes. Managed `denied` is excluded from both. Every request must supply matching Vault fingerprint and expected index revision; either mismatch fails before returning results. The package does not authenticate a caller or establish freshness by rescanning the Vault; those responsibilities remain with a future authorized Core caller.
- The executable synthetic runner executes every declared `evals/golden/retrieval.jsonl` case and compares applicable thresholds in `evals/thresholds.json`. Exact lookup accuracy is correct exact cases divided by all exact cases. Decision why Recall@5 and Project key-item Recall@10 are micro recall: expected IDs present in the first 5 or 10 results divided by all expected IDs in their respective tagged cases. Wrong-Vault and privacy failures are event counts. The runner reports unrelated gates as `not_run`; it does not change or waive them.

## Alternatives considered

1. Case-sensitive tiered user lookup, outgoing-only traversal and sparse Pack: less code, but it misses incoming Project knowledge and conceals title/alias collisions across tiers.
2. Full restricted/local-only policy capabilities and Core endpoints in this slice: more coverage, but an index package cannot authenticate a grant or approved local backend. That requires separate protocol and privacy decisions.

## Consequences

`@ideomy/index`, `@ideomy/graph` and `@ideomy/retrieval` gain typed package APIs and synthetic goldens. No Core endpoint, Plugin, model route, M1.2 transaction or canonical Vault mutation is introduced. Future model-facing callers must validate their own authenticated Vault-scoped authority and expected index revision before using this package result.
