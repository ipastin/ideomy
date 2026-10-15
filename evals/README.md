---
title: "Ideomy Executable Eval Corpus"
created: "10-10-26 15-41-48"
updated: "12-10-26 15-40-10"
version: "0.10.0"
status: "accepted"
commit: "docs(readiness): harden Ideomy specification for Codex implementation"
---

# Ideomy Executable Eval Corpus

Created: 10-10-26 15-41-48  
Updated: 12-10-26 15-40-10  
Version: 0.10.0

Initial synthetic golden corpus shipped with the Specification Pack. Real Personal Vault content is prohibited.

- `thresholds.json` — initial machine gates
- `golden/classification.jsonl` — 60 classification cases
- `golden/entity_resolution.jsonl` — 30 resolution cases
- `golden/retrieval.jsonl` — canonical retrieval cases
- `golden/security.jsonl` — privacy/injection/auth cases
- `golden/mutation.jsonl` — transaction/write cases
- `golden/web_capture.jsonl` — capture-envelope, dedup and trust-boundary cases.
