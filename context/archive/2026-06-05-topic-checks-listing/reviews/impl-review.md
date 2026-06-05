# Implementation review — topic-checks-listing

Slice review gate, 2026-06-05. Four read-only checks fanned out in parallel
(`/10x-impl-review`, `/tailwind-v4-audit`, `feature-first-structure`,
`/module-cohesion-audit`), then `/simplify` acted on the triage.

## Verdict: APPROVED

Automated criteria re-run green during review: `pnpm typecheck`, `pnpm lint`,
`pnpm build` (`/topic-checks` in the route manifest), and the no-dangling-refs
grep for the `NotesFilter` promotion.

| Dimension                      | Result                                                 |
| ------------------------------ | ------------------------------------------------------ |
| Plan adherence                 | PASS                                                   |
| Scope discipline               | WARNING (F1)                                           |
| Safety & quality               | PASS                                                   |
| Architecture                   | PASS                                                   |
| Pattern consistency            | WARNING (F2)                                           |
| Tailwind v4                    | CLEAN (0 violations)                                   |
| feature-first (inter-module)   | PASS (deletion test + SubjectFilter promotion correct) |
| module-cohesion (intra-module) | PASS (no god/grab-bag files)                           |

## Findings & triage

- **F1 (warning → FIXED):** `change.md` still listed "no edit/delete from this
  list" under Out-of-scope while the shipped code + plan addendum added them.
  Synced the change.md note in the `/simplify` commit (`3330601`).
- **F2 (warning → FIXED):** the topic-check edit deep-link string was duplicated
  in `topic-check-card-actions.tsx` and `topic-checks-section.tsx`. Extracted
  `topicCheckEditHref(noteId, id)` (`features/topic-checks/utils/`), used in both
  (`3330601`).
- **Efficiency / Simplification (FIXED):** `formatReviewStatus` had a local
  `zoneMidnight` duplicating the `date.ts` encoding, and `isoDateInZone` rebuilt
  an `Intl.DateTimeFormat` per card. Generalized `zoneMidnight` into `date.ts`
  (reused by `todayInZone`) and memoized the formatter per timezone (`3330601`).
- **Altitude / freshness (FIXED):** `create`/`update` topic-check actions didn't
  revalidate `/topic-checks`, so the listing went stale on create/edit. Added the
  revalidation to match `delete` (`3330601`).
- **F3/F4/F5 (observations, dismissed — verified benign):** AnimatedCardList
  restructure does not regress notes/subjects (CardAction conditional; `mt-auto`
  no-ops in the non-grid stack); `notes!inner` subject filter correct per the
  PostgREST inner-join-required contract; `formatReviewStatus` day-math is
  DST-safe (zone-midnight anchored).

## Deferred / not-this-slice → see `../follow-ups/review-fixes.md`

- Promote a shared `SubjectChip` (3rd consumer; overlaps EX-380).
- `create_note_with_checks` doesn't revalidate `/topic-checks` (low impact).
- No Tailwind-aware ESLint plugin (repo-wide).
- `goal-progress-bar.tsx` cohesion flag — parallel dashboard work, not this slice.

## Tests (authored post-`/simplify`, per the gate order)

- Unit `src/__tests__/format-review-status.test.ts` — green (4 tests).
- E2E `e2e/topic-checks-listing.spec.ts` — blocked at run time by the documented
  local GoTrue sign-up race (`lessons.md`), not by its assertions. typecheck +
  lint + unit (61) + build all green; feature manually verified by the owner.
