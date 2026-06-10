---
change_id: link-unlinked-card-to-note
title: Link an unlinked memory card to an existing note
status: implementing
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

The missing inverse of unlink: a standalone card (`note_id = null`) cannot currently be attached
to an existing note. Add it.

**Shape (brainstormed, approved):**

- `linkCardToNote(cardId, noteId)` server action — inverse of `unlinkCardFromNote`. Re-reads the
  note's `subject_id` and writes `{ note_id, subject_id: note.subject_id }` onto the card, so the
  invariant "a linked card shares its note's subject" holds by construction (the note is the source
  of truth, not the dialog's filter). Revalidates `/memory-cards`, `/memory-cards/[cardId]`,
  `/notes/[noteId]`.
- `getNotesForLinking(subjectFilter)` query — slim `{ id, title }[]` for one subject (or
  `subject_id IS NULL` when "None"), recency-ordered, capped (~200). Whole set loaded; existing
  `Combobox` does the client-side filtering. Subject-scoping is what bounds the payload.
- `LinkCardToNoteDialog` — mounted only while open. Subject-select (single, required, `allowNone`,
  pre-filled from the card's current subject / "None" if unfiled) drives a note-select that refetches
  on subject change. Link submit disabled until a note is picked. No subject-change notice/confirm —
  the subject picker is itself the visible control.
- Three triggers sharing the dialog, each **conditionally rendered only when `note_id` is null**
  (hidden, never disabled, on already-linked cards): cards listing (`CardActions`), card view page,
  and the edit form (exact mirror of the existing "Source note + Unlink" row — the two rows are
  mutually exclusive).

**Out of scope (YAGNI):** server-side note search/pagination in the dialog, bulk linking, linking
from the note side, drag-drop.
