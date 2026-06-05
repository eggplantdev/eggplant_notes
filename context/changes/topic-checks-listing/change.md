---
change_id: topic-checks-listing
title: Topic-checks listing page with server-side subject filtering
status: implementing
created: 2026-06-05
updated: 2026-06-05
archived_at: null
---

## Notes

New slice: a `/topic-checks` page listing all of the user's topic-check cards in a flat
grid, mirroring the notes listing UX — same multiselect subjects filter (server-side via
`?subjects=`), same selected-subject chips, same post-filter count in the PageShell
subtitle, same grid. Topic-checks are only transitively tied to a subject
(`topic_checks.note_id → notes.subject_id`), so subject filtering joins through notes.
Each card shows the prompt + subject chip + note title + due/review status; clicking jumps
to the parent note and scrolls to that exact card (`/notes/[noteId]#check-[id]`) — leaning
into the documented card→note differentiator.

Approved design decisions (brainstorm 2026-06-05):

- Layout: flat list + subjects filter (exact notes mirror), NOT per-subject grouped sections.
- Card click → parent note, deep-linked to the card via `#check-[id]` anchor.
- Card content: prompt (title) + subject chip + note title + due/review status label.
- Filter: PROMOTE `NotesFilter` → `features/subjects/components/subject-filter.tsx`
  (2nd consumer; subject-domain code → subjects feature, not domain-free `src/components/`).
  Pages compose it at the route layer. Selected-subject chips come along for free.
- New due/review status helper needed (none exists): maps FSRS `state` smallint
  (0=New,1=Learning,2=Review,3=Relearning) + `due_at` → human label. Lives in
  `features/topic-checks/utils/`.
- Out of scope (YAGNI): no detail route, no grouping, no edit/delete from this list, no migration.
