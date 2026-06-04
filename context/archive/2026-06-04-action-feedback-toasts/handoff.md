# Handoff — 2026-06-04

Session summary for whoever picks this up (human or agent). Two bugfixes shipped; one slice fully
planned and ready to implement.

## TL;DR — where to resume

The **action-feedback-toasts** slice is `planned` (not implemented). Next step:

```
/10x-plan-review action-feedback-toasts      # validate the plan
/10x-implement action-feedback-toasts phase 1 # then build
```

Read `plan-brief.md` first, then `plan.md`. All design decisions are locked (see the brief's
decision table) — no open questions.

## What shipped this session (committed to `main`)

| Commit    | What                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `b63cf89` | **Seed UUID bugfix.** Seeded ids used version/variant nibbles of `0` (`…-0000-0000-…`); Postgres accepts them but Zod `z.uuid()` rejects → every Server Action mutation on seeded data failed validation (`"Invalid id"`) and reverted silently. Fixed generator + `seed.sql` to valid v4 (`…-4000-8000-…`). |
| `af0b0ba` | **Hydration bugfix.** `<DndContext>` got a stable `id="subject-note-reorder"` — dnd-kit's `aria-describedby` was non-deterministic (`DndDescribedBy-0` server vs `-4` client).                                                                                                                               |
| `00d1f4a` | **Toast slice start.** Added `react-toastify@11.1.0` (mirrored from `wykonczymy`) + `change.md` + `research.md`. No toasts wired yet.                                                                                                                                                                        |

The original report ("dnd doesn't work — items snap back") was **fully root-caused and fixed** (it
was the seed UUID bug, surfacing through `reorderNote`'s `z.uuid()` validation → silent revert).
Verified end-to-end via Playwright after a `supabase db reset`: reorder now persists, 0 console errors.

## The slice: action-feedback-toasts (PLANNED)

**Goal:** uniform `react-toastify` feedback so no mutation fails or succeeds silently. Errors scream
(viewport-fixed) and keep their inline `<FormError>`; successes confirm.

**Locked decisions:**

- Errors toast **and** keep inline `<FormError>` (both channels). Field-level Zod errors stay inline only.
- Converge **all** imperative call sites onto `useActionTransition` (the single seam) — it fires error + success toasts.
- Forms toast via a shared `toastActionResult(result, {successMessage})` helper called in each `onSubmit`.
- The 10 **redirect-on-success** actions can't toast in-closure (`redirect()` throws) → generalize `?deleted=1`→`DeletedNotice` into a reusable `?toast=<key>` reader; delete `deleted-notice.tsx`.
- Per-call-site success messages ("Order saved", "Note deleted", …).
- **sign-out left as-is** (the one knowingly-silent site — rarely fails, redirect is feedback).

**4 phases** (full detail + per-phase success criteria in `plan.md` `## Progress`):

1. Toast foundation — `src/components/toasts.ts` + `<ToastProvider>` (`'use client'`) mounted in `src/app/layout.tsx`.
2. Imperative seam — extend `src/hooks/use-action-transition.ts`; migrate reorder, note-subject-picker, delete-note, delete-subject, delete-account onto it; rating + topic-check-delete gain `successMessage`.
3. Form seam — `toastActionResult` helper; wire all 6 forms (success toasts on the 2 silent-success topic-check forms; error toasts everywhere; redirect-form success rides Phase 4).
4. Post-redirect reader — `?toast=<key>` map + `src/components/action-toast.tsx` reader (needs `<Suspense>`); append flag in the 10 redirect actions; remove `DeletedNotice`.

Tests (Playwright + unit) come **after** the review→`/simplify` gate per CLAUDE.md, not during the phases.

## Environment state

- **On `main`.** The slice needs isolation before implementing — decide branch vs `git worktree` (lean worktree per the parallel-session lesson). Worktrees don't carry `.env.local` (gitignored) — `cp` it in + `mise trust`.
- **`supabase db reset` was run this session** — local DB rebuilt from the fixed seed. Two accounts: `dev@example.com` / `password123` (smoke bed) and `test@gmail.com` / `test@Test` (52-note playground; subject now `5b1ec700-0000-4000-8000-000000000001`).
- Supabase stack up (`:54321`); a `next dev` server is on `:3000` (turbopack).

## ⚠️ Live parallel session in this tree

Another session is **actively planning** `shiki-lang-source-of-truth` right now — its
`context/changes/shiki-lang-source-of-truth/{change.md, plan.md, plan-brief.md}` are uncommitted in
this shared working tree. Per `lessons.md` ("stage by explicit path, never `git add -A`"): commit
ONLY your slice's paths by name. The `main` log also shows that session's recent commits (`7f20146`
dashboard, `a9315af`/`83e7ecd` S-12…S-15 roadmap slices). Prefer a `git worktree` for the toast
implementation to make cross-contamination structurally impossible.

## References

- `context/changes/action-feedback-toasts/{plan-brief,plan,research}.md`
- Reference toast pattern: `/Users/konradantonik/workspace/yolo/wykonczymy/src/components/toasts.ts`
