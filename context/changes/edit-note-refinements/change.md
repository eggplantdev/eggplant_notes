---
change_id: edit-note-refinements
title: Defer note-edit weight and add list-level edit/delete shortcuts (S-14 follow-up)
status: implemented
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

Follow-up to S-14 (inline-edit-notes-and-subjects). Three changes on the note detail/list surfaces:

1. **Defer the add-check editor.** `TopicChecksSection` unconditionally renders the add-mode `TopicCheckForm`, which mounts a `dynamic({ ssr:false })` CodeMirror — so every note _read_ fetches + hydrates an editor it doesn't need. Collapse the add form behind an on-demand "Add check" toggle (small `'use client'` child, since the section is an async Server Component). Reveal when `?edit=<checkId>` is set (edit existing — stays server-driven) OR the user clicks "Add check" (client `useState`). Read mode then mounts zero CodeMirror; the chunk is fetched only on click. The new-note view already does this (empty `checks: []` + "Add check"); this brings the detail view in line — same UX pattern, not literal code reuse (detail checks are persisted rows with per-check create/update via existing `TopicCheckForm`).

2. **Subject select → edit view only.** Remove `NoteSubjectPicker` from the detail read view (`page.tsx`); the edit-mode `NoteForm` Combobox already covers subject assignment. Trade-off: lose one-click subject reassign from read view — accepted, offset by #3. `NoteSubjectPicker` (`components/note-subject-picker.tsx`) + its `assignNoteSubject` action (`actions/assign-subject.ts`) become dead code (grep-confirmed: only consumer, no tests) → delete both.

3. **Edit + Delete shortcuts on the notes listing.** `AnimatedCardList` already exposes a `renderAction(item)` slot — wire it from `NotesList`. Card is a `<Link>`, so each action must `preventDefault`/`stopPropagation` (precedent: `SubjectCardNewNoteButton`). Edit → link to `/notes/[id]?edit=note`; Delete → reuse existing `DeleteNoteButton`.

**Carry-in (fold into this slice, not new scope):** existing e2e TODO in `animated-card-list.tsx:39` — list rows became `<div>`/`motion.div` (no `<ul>/<li>`), so stale `getByRole('listitem')`/`locator('li')` locators in `notes.spec`/`subjects.spec` need fixing. We touch the list anyway.

Full per-slice gate applies (review fan-out → /simplify → tests → archive). Test layer authored after review + /simplify.
