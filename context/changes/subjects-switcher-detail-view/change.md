---
change_id: subjects-switcher-detail-view
title: Replace the subjects list with an in-detail subject switcher
status: planned
created: 2026-06-10
updated: 2026-06-10
archived_at: null
---

## Notes

Collapse the standalone `/subjects` card list into the single-subject detail view.
Approved design (brainstorm 2026-06-10):

- **Subject switcher (new component)** — a `Combobox`-based navigation switcher built from
  `getSubjects()` (full id/title set, already used by the form selects). Picking a subject does
  `router.push('/subjects/[id]')` (soft RSC nav). Sits in the detail view's **eyebrow** slot
  (Design A — no change to shared `PageShell`), next to a **"New subject"** button → `/subjects/new`.
- **Header relabels** — bare `Edit`/`Delete` → **"Edit subject"** / **"Delete subject"** (they act on
  the subject, were ambiguous).
- **Move add-note** — the old header **"New note"** moves to **below the description** and becomes
  **"Add note to this subject"** → `/notes/new?subject=[id]`. Header actions drop from three to two.
- **`/subjects/page.tsx`** — no longer a list: redirect to the first subject's detail; zero-subjects →
  empty state → "Create your first subject". (`deleteSubject` already redirects to `/subjects`, so
  delete auto-lands on the next subject.)
- **Dead code to remove** — `subjects-list.tsx`, the `getSubjectsList` query, and `SubjectListItemT`
  (all listing-only). Keep shared `SearchFilterInput` / `PaginationFooter` — `/notes` + `/memory-cards`
  still use them.

Verify at plan time: `subject-filter.tsx` current usage; where `create-subject` redirects after save
(ideally onto the new subject).

Implementation will happen in a **separate worktree** branched off local `main` after this branch
merges — so this change folder must be committed before that merge to ride into the worktree.
