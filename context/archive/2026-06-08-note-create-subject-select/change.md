---
change_id: note-create-subject-select
title: New-or-existing subject selector on the create-note form (shared)
status: archived
created: 2026-06-08
updated: 2026-06-08
archived_at: 2026-06-08T19:51:38Z
---

> Review gate (2026-06-08): automated legs green; review confirmed the migration is RLS-safe and import
> testids preserved; /simplify applied the NO_SUBJECT dedup + dead create-default fix. Manual + E2E
> (incl. import-notes.spec.ts for the import refactor) deferred to a batched pass per user direction.

## Notes

Dogfooding gap: the create-note form can only assign an EXISTING subject (a plain Combobox) — you can't
create a new subject inline. The new/existing toggle exists only in the import flow (`import-panel.tsx`),
inline and unextracted. The card form is the same as the note form (existing-only) — the user's "make it
like the card form" premise was off; the real source is import.

Scope (chosen: note form, atomic via RPC migration; card form unchanged):

1. **Shared `SubjectSelect` component** (`features/subjects/components/`) — extract the import toggle:
   SegmentedToggle (New / Existing) → Input (new title) or Combobox (existing, optional "None"). Controlled,
   `testIdPrefix` so import keeps its E2E testids. Used by BOTH the note form and import-panel (DRY — the
   user asked for "the same component").
2. **Atomic subject resolution in `create_note_with_checks`** — new migration mirrors `import_notes`: when
   `p_note.subject_id` is null and `subject_title` is present, insert the subject and use its id, all in the
   one transaction. RLS still owns ownership (SECURITY INVOKER).
3. **Schema + action**: create-note payload gains optional `subject_title`; `createNote` passes it through
   and computes `position` from "has any subject".

Out of scope: standalone card form (stays existing-only); edit-note subject UI (existing Combobox, no new-
subject need); changing how notes/cards persist beyond the subject-resolution arm.
