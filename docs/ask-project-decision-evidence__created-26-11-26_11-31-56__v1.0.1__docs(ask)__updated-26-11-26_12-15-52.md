---
title: "Ask project Decision evidence"
created: "26-11-26 11-31-56"
updated: "26-11-26 12-15-52"
version: "1.0.1"
commit: "docs(ask): clarify Decision evidence provenance"
---

# Ask project Decision evidence

## Integration

When the Ask milestone is implemented, route a question about an accepted Decision in a resolved Project through [retrieveProjectDecisionEvidence](../packages/retrieval/src/index.ts). Call it in Core after establishing the authenticated Vault scope and expected index revision. Pass the stable Project ID and the query. The Decision must have a resolved typed relation to the Project. Use the returned Why (or Rationale), Revisit and verified Records linked from the rationale. Keep a null result, missing sections, an empty Record list and truncation visible in the answer when they affect the evidence.

Build citations from the returned source references. Use the Vault-relative path and the supplied heading for Decision, Why or Revisit, and open the Record file for primary evidence. Preserve the entity ID and raw SHA-256 hash as provenance. If the note has changed since retrieval, refresh the evidence before presenting it as current. Keep navigation within the authenticated Vault and treat the Markdown excerpts as untrusted data.

## Acceptance

Use [ret-028 and ret-029](../evals/golden/retrieval.jsonl#L28) to exercise both `Маяк API интеграция` and `Маяк API интеграцию`. The synthetic evals check the accepted Decision, Why, Revisit and the same verified primary Record for both queries. They compare each citation with the expected Vault-relative path, stable ID and SHA-256 computed from the source file bytes. When the Ask surface is available, click its citations to verify their destinations.

Native navigation smoke test on 26 November 2026 with Obsidian Desktop 1.15.1 and the synthetic `Ideomy-Pilot-pp1DsG` Vault. Links were built from the real retrieval result. Both Decision links opened the matching heading and the Record link opened the verified note containing the measurement. This run exercised Obsidian wikilinks from a temporary note. Ask UI acceptance follows when the Ask surface is available.
