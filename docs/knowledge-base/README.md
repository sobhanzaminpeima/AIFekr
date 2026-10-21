# AIFekr knowledge base

These files are what the floating support assistant answers from. They are the
only content it is allowed to ground on — nothing user-submitted is ever
ingested, which is what keeps retrieval from becoming a prompt-injection route.

## How to edit

Edit the markdown, then have an admin `POST /api/admin/kb/sync`. Only the
sections whose text actually changed get re-embedded, so fixing a typo costs
one embedding call, not a full re-index. No deploy is needed for a content
change that ships in the same tree; a deploy plus one sync covers both.

`GET /api/admin/kb/sync` shows what is currently indexed without changing
anything — use it to check that a sync did what you expected.

## File format

One file per topic, **all three languages in the same file**. That is
deliberate: keeping fa/en/de side by side means whoever edits one block can see
the other two, and German stops quietly going stale (it has before — see commit
`e24f208`). The sync report lists any file missing a language, so a gap is loud.

```markdown
---
slug: crm
capability: crm
---

<!--lang:fa-->
# عنوان سند
### یک بخش
متن…

<!--lang:en-->
# Document title
### A section
text…

<!--lang:de-->
# Dokumenttitel
### Ein Abschnitt
Text…
```

- **`slug`** must match the filename and a `docSlug` in
  `src/lib/orchestrator/registry.ts`. A slug nothing references is reported as
  unreferenced; a registry slug with no file is reported as missing.
- **`capability`** is optional — set it when the document describes exactly one
  capability, so answers can carry a direct link to that page. Leave it out for
  cross-cutting documents (`navigation`, `account`, `troubleshooting`).
- **Every `###` heading becomes one retrievable chunk**, and the heading is what
  gets shown as the citation. So write headings a user would recognise
  ("Why can't I see invoices?"), and keep each section a complete thought that
  reads correctly on its own — a chunk is retrieved without its neighbours.

## What to write

Four sections per topic works well: what it is, where to find it, how to use it,
and what its limits are. The limits section matters most — an assistant that
admits "publishing to Instagram is always a manual step" is more useful, and
more trusted, than one that promises something the product does not do.

Write what the product actually does today. If a feature is half-built, say so
here rather than letting the assistant improvise.
