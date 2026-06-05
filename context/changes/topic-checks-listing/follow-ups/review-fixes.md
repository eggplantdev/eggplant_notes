# Review fan-out — deferred findings (topic-checks-listing)

Triaged 2026-06-05 after the slice review gate. Fixed-now items (F1 doc sync,
F2 href helper) were handled in the `/simplify` pass; below are the deferrals.

## Deferred

- **Promote a shared `SubjectChip`** (reuse/simplify finding). The subject-chip markup
  (`bg-muted text-foreground rounded px-1.5 py-0.5 font-medium`) now renders in 3 places:
  `notes-list.tsx`, `topic-checks-list.tsx`, and the `subject-filter.tsx` chip button. Past the
  2nd-consumer threshold, but the three vary (button + `X` icon + `hover:` vs spans; `w-fit` vs
  `max-w-full`; where `text-xs` sits), and this overlaps the parallel EX-380 shared-primitives
  work. Extract a `SubjectChip` (visual base + `className` passthrough) in a dedicated change so
  it doesn't collide. Not done here to avoid fighting the in-flight EX-380 edits.

- **`create_note_with_checks` (note-with-inline-checks) does not revalidate `/topic-checks`.**
  This slice added `revalidatePath('/topic-checks')` to the direct create/update/delete topic-check
  actions, but the S-07 note-creation-with-inline-checks path revalidates only `/notes`. A note
  created with checks won't appear on `/topic-checks` until cache expiry. Low impact (fresh route,
  brief staleness); add the revalidation to that note-create path if it matters.

- **No Tailwind-aware ESLint plugin** (repo-wide, out of scope for this slice).
  `eslint.config.mjs` has no `eslint-plugin-better-tailwindcss` (or equivalent),
  so the three pre-v4 pattern classes (`[var(--x)]`, inline `style`, arbitrary
  `[...]` values) are editor-only and invisible to `pnpm lint`/CI. This slice is
  clean, but nothing enforces it going forward. Wire in the v4-native plugin
  (point `entryPoint` at `src/app/globals.css`) in a dedicated tooling change.

## Dismissed / not-this-slice

- `src/components/ui/goal-progress-bar.tsx` flagged by module-cohesion (component
  file exports 1 non-component symbol) — belongs to the parallel dashboard/goal
  work (EX-380 family), not this slice.
