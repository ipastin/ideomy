---
title: "ADR-144 — Recognize AUTO body markers only as standalone comments"
created: "16-10-26 13-11-57"
updated: "16-10-26 13-11-57"
version: "0.1.0"
status: "accepted"
commit: "fix(vault-io): restrict AUTO markers to standalone comments"
---

# ADR-144 — Recognize AUTO body markers only as standalone comments

Created: 16-10-26 13-11-57  
Updated: 16-10-26 13-11-57  
Version: 0.1.0  
Change: `fix(vault-io): restrict AUTO markers to standalone comments`

## Context

`20_VAULT_IO_AND_SCHEMA` §13 reserves delimited AUTO body sections for generated content and requires all surrounding user content to be preserved. A line that looks like `<!-- BEGIN AUTO:name -->` can also appear inside a raw HTML block such as `<pre>` or within a larger multiline HTML comment. Recognizing that line by substring would incorrectly assign ownership of user content before any AUTO body writer is implemented.

## Decision

An AUTO boundary is recognized only when the whole top-level Markdown HTML node is exactly one `<!-- BEGIN AUTO:name -->` or `<!-- END AUTO:name -->` comment on one source line; leading and trailing whitespace on that line is allowed. Marker names and pairing diagnostics retain the rules of §13.

Marker-looking lines inside raw HTML blocks, larger multiline HTML comments, code fences, quotes, lists, or inline text are user-owned text. They neither open nor close an AUTO section and do not themselves produce marker diagnostics. A writer may replace content only between a valid recognized pair and must reject malformed recognized boundaries as §13 requires. This decision adds no AUTO body write capability.

## Alternatives considered

1. Match marker-looking source lines wherever they occur. This can grant ownership inside user-controlled raw HTML.
2. Parse nested HTML to find comment tokens. This adds complexity without changing the desired ownership rule.

## Consequences

Synthetic regression cases cover valid standalone boundaries and marker-looking lines inside `<pre>` and larger multiline HTML comments. The extractor fails closed for those ambiguous contexts; a later AUTO writer can use its recognized sections without silently adopting their contents.
