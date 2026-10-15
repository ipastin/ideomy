---
title: "Ontology & Data Model"
created: "06-10-26 16-40-00"
updated: "12-10-26 16-30-30"
version: "0.11.0"
status: "accepted"
commit: "refactor(brand): adopt Ideomy canonical namespace"
---

# Ontology & Data Model

Created: 06-10-26 16-40-00  
Updated: 12-10-26 16-30-30  
Version: 0.11.0  
Change: `refactor(brand): adopt Ideomy canonical namespace`

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
