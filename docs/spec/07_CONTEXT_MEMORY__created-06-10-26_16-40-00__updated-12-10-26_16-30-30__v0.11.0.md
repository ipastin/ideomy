---
title: "Context & Memory Model"
created: "06-10-26 16-40-00"
updated: "12-10-26 16-30-30"
version: "0.11.0"
status: "accepted"
commit: "refactor(brand): adopt Ideomy canonical namespace"
---

# Context & Memory Model

Created: 06-10-26 16-40-00  
Updated: 12-10-26 16-30-30  
Version: 0.11.0  
Change: `refactor(brand): adopt Ideomy canonical namespace`


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
