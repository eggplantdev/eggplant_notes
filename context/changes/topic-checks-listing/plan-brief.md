# Topic-checks Listing Page — Plan Brief

> Full plan: `context/changes/topic-checks-listing/plan.md`

## What & Why

Add a `/topic-checks` page that lists all of the user's topic-check cards in a flat, filterable
grid — mirroring the notes listing. Today the recall cards are only reachable one-at-a-time in the
`/review` queue or buried inside a note's detail view; there's no way to browse the whole set. This
surfaces them as a browsable, subject-filtered view and reinforces the card→note differentiator.

## Starting Point

The notes listing (`src/app/(protected)/notes/page.tsx`) already implements exactly this UX for notes:
server-side `?subjects=` filtering, a debounced multiselect with selected chips, a post-filter count, and
an animated card grid. topic_checks link to notes (`note_id`), and notes link to subjects (`subject_id`),
so the listing reuses that whole pattern — it just joins through notes to filter by subject.

## Desired End State

`/topic-checks` (new nav entry) shows every owned check as a card — prompt + subject chip + source-note
title + due/review status — ordered soonest-due first. A subjects multiselect filters server-side with
chips and a live count, identical to notes. Clicking a card opens `/notes/[noteId]#check-[id]` scrolled to
that check. The notes page is behaviorally unchanged.

## Key Decisions Made

| Decision         | Choice                                      | Why (1 sentence)                                                            | Source |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| Layout           | Flat list + subject filter (notes mirror)   | Exact parity with notes; no grouped sections.                               | Frame  |
| Card click       | Parent note, deep-linked to the card        | Leans into the documented card→note path; no new detail route.              | Frame  |
| Card content     | Prompt + subject chip + note title + status | Recall cue + context for the jump + study readiness.                        | Frame  |
| Filter location  | Promote `NotesFilter` → `SubjectFilter`     | 2nd consumer ⇒ lift to subjects feature (domain code, not domain-free dir). | Frame  |
| Status label     | New `formatReviewStatus` helper             | No relative-time/state formatter exists today.                              | Frame  |
| List ordering    | `due_at` ascending                          | List doubles as study-readiness; reuses `(user_id, due_at)` index.          | Plan   |
| Anchor mechanism | Native hash + `scroll-mt`                   | Zero client JS; matches existing `#topic-check-form` anchor pattern.        | Plan   |

## Scope

**In scope:** `/topic-checks` page; filtered `getTopicChecksList` query + list-item type; `formatReviewStatus`
helper; promote filter to `SubjectFilter`; `TopicChecksList` card grid; `id`/`scroll-mt` anchors on note-detail
checks; nav entry.

**Out of scope:** topic-check detail route; grouped-by-subject sections; edit/delete from the list; any DB
migration or new mutation; client scroll effect.

## Architecture / Approach

Server Component page parses `?subjects=` → `Promise.all([getSubjects(), getTopicChecksList({ subjectIds })])`
→ `PageShell` → `SubjectFilter` + `TopicChecksList`. The query embeds `notes!inner(title, subject_id,
subjects(title))` and filters via `.in('notes.subject_id', …)` (inner join required to filter an embed).
The card grid reuses `AnimatedCardList`; the card→note jump uses native hash anchors on the server-rendered
note-detail check list.

## Phases at a Glance

| Phase                         | What it delivers                                      | Key risk                                              |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| 1. Data layer                 | Filtered query + list-item type + status helper       | `notes!inner` filter syntax; relative-time edge cases |
| 2. Promote filter             | `NotesFilter` → `SubjectFilter`, notes page repointed | Behavior regression on the notes page                 |
| 3. Page + list + anchor + nav | The page, card grid, note-detail anchors, nav entry   | Cross-document native hash scroll reliability         |

**Prerequisites:** local Supabase stack up for manual verify; seeded checks (`supabase db reset`).
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Native cross-document hash scroll (`/topic-checks` → `/notes/[id]#check-[id]`) may not fire reliably under
  App Router client navigation; fallback is a small client scroll effect (flagged in Phase 3 manual verify).
- Assumes personal-scale data (fetch-all is fine), consistent with `getChecksForStats`.

## Success Criteria (Summary)

- `/topic-checks` lists every check, due-first, with prompt + subject + note title + status.
- The subjects filter narrows the list server-side with chips + count, exactly like notes; notes page
  unchanged.
- Clicking a card lands on the parent note scrolled to that check.
