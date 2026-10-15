# Ideomy Web Clipper Template Pack

Version: 0.10.0  
Updated: 12-10-26 15-40-10

Ideomy Web Capture V1 uses the **official Obsidian Web Clipper** as the primary browser capture frontend. These templates intentionally create lightweight **capture artifacts**, not canonical Ideomy `source` entities.

## Install

1. Install Obsidian Web Clipper from the official browser store.
2. Open Web Clipper → Settings → Templates.
3. Import the JSON files in `templates/` (or drag them into the template area).
4. Keep **Ideomy — Web Capture** as the fallback template.
5. Ensure the target Vault is the Personal Vault configured for Ideomy.

Official documentation:
- https://obsidian.md/help/web-clipper
- https://obsidian.md/help/web-clipper/templates
- https://obsidian.md/help/web-clipper/variables

## Templates

- `ideomy-web.json` — fallback; `{{content}}` automatically follows page/selection/highlight behavior provided by Web Clipper.
- `ideomy-selection.json` — explicit selected-text capture.
- `ideomy-highlights.json` — explicit saved-highlights capture.

All templates save to:

```text
01 Inbox/Web
```

## Boundary

Clipper responsibilities:

```text
extract + preserve provenance + write Inbox capture
```

Ideomy Core responsibilities:

```text
normalize URL/provenance
→ detect duplicate
→ classify
→ create/update canonical Source if justified
→ connect Area/Project/Knowledge
→ review when ambiguous
```

The templates do **not** use Web Clipper Interpreter/prompt variables by default. Semantic interpretation remains in Ideomy Core/Model Gateway so privacy, model routing, evals and ontology rules stay centralized.
