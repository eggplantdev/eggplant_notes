---
change_id: merge-card-example-and-code-context
title: Collapse memory_cards.code_context into a single example markdown field
status: new
created: 2026-06-26
updated: 2026-06-26
archived_at: null
---

## Notes

Collapse `memory_cards.code_context` into `example` so a card has ONE markdown answer
field instead of two. Today both columns render identically (stacked `RenderMarkdown`),
so the split is authoring-only — its sole purpose was dodging the heavy CodeMirror editor
load by giving `example` a plain textarea and gating `code_context` behind an opt-in editor.
New UX target: one field that starts as a cheap textarea and upgrades to the markdown
editor on demand.

Prod data (read-only Management API count, 2026-06-26): 185 cards total, 52 with non-empty
`code_context` — 50 case-B (both `example` + `code_context` set) → fold as
`example || E'\n\n' || code_context`; 2 case-A (code only) → `example := code_context`.
Samples confirmed: `example` is prose, `code_context` is a fenced block, so `\n\n` reproduces
the current rendered block break with no fence collisions.

Three-step plan (user-approved):

1. Identify problematic cards (DONE — counts above).
2. Patch: idempotent UPDATE folding `code_context` into `example`, then null it — authored as
   the first half of the migration; user applies to prod (agent never pushes prod DB).
3. Migrate to one field: DROP COLUMN `code_context` + collapse all code touchpoints.

Blast radius (four-surfaces contract — must move in lockstep):

- DB: migration (patch + drop column); regen `lib/supabase/types.ts`.
- Schemas/types: `memory-cards/schemas.ts`, `types.ts`.
- API routes (selects): `api/memory-cards/route.ts`, `api/notes/[id]/route.ts`.
- Core mutation modules (shared by routes + actions): `*-core.ts`.
- Forms (3): `card-form.tsx`, `memory-cards-field.tsx`, `memory-card-form.tsx` — unify to one
  example editor (textarea→markdown upgrade).
- Render (3): `review-panel.tsx`, `memory-cards-section.tsx`, `note-memory-cards-list.tsx`.
- AI gen: `generate-cards-button.tsx`, `cardsMaterialFromNote`, `GeneratedCardT`.
- Contract docs: skill template (`skill-template.ts` + source `.md` + regen) AND FAQ (`faq-data.ts`).
- Sample data: `sample-data/remap.ts`, seed scripts; ~6 test specs.

Constraint: local data is real — never `supabase db reset`; apply via `migration up`. Prod
migration applied by hand by the user.
