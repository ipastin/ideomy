---
title: "Knowledge Intelligence & Retrieval"
created: "06-10-26 16-40-00"
updated: "12-10-26 16-30-30"
version: "0.11.0"
status: "accepted"
commit: "refactor(brand): adopt Ideomy canonical namespace"
---

# Knowledge Intelligence & Retrieval

Created: 06-10-26 16-40-00  
Updated: 12-10-26 16-30-30  
Version: 0.11.0  
Change: `refactor(brand): adopt Ideomy canonical namespace`


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
