# Action Feedback Toasts — Plan Brief

> Full plan: `context/changes/action-feedback-toasts/plan.md`
> Research: `context/changes/action-feedback-toasts/research.md`

## What & Why

Add a uniform `react-toastify` feedback layer so every mutation surfaces its outcome — failures
scream, successes confirm. Trigger: a `reorderNote` failure silently reverted the UI, its only signal
an off-screen `<FormError>` below 52 notes. The user had no idea anything went wrong.

## Starting Point

19 Server Actions return a uniform `ActionResultT` (except `signOut`). There is no chokepoint: forms
hand-roll `onSubmit` result handling; imperative sites split between the shared `useActionTransition`
hook and bare `useTransition`. Errors only ever render inline (can scroll off-screen); 6 sites have
silent successes. `react-toastify@11.1.0` is installed but unwired.

## Desired End State

Every mutation toasts. Errors toast **and** keep inline `<FormError>` (both channels). Successes
toast — imperative/return-only forms in-handler, the 10 redirect actions via a `?toast=<key>` flag
read after navigation. One imperative seam, one form helper, one post-redirect reader; a new action
can't easily regress to silent.

## Key Decisions Made

| Decision         | Choice                                                      | Why                                                  | Source   |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------------- | -------- |
| Library          | react-toastify@11.1.0                                       | Mirror the `wykonczymy` reference stack              | Research |
| Scope            | Errors + success                                            | User wants both surfaced everywhere                  | Plan     |
| Error channel    | Keep inline `<FormError>` AND toast                         | User chose both; no removal risk                     | Plan     |
| Wiring depth     | Converge imperative sites onto `useActionTransition`        | One enforceable seam vs per-site                     | Plan     |
| Redirect success | Generalize `?deleted=1` → reusable `?toast=<key>` reader    | Closure dies past `redirect()`; reuse proven pattern | Plan     |
| Success messages | Per-call-site explicit strings                              | Precise copy over a vague default                    | Plan     |
| sign-out         | Leave as-is                                                 | Rarely fails; redirect is feedback                   | Plan     |
| `?deleted=1`     | Migrate to `?toast=account-deleted`, delete `DeletedNotice` | One mechanism, no dead component                     | Plan     |

## Scope

**In scope:** toast primitive + container; `useActionTransition` toasts + migrate all imperative
sites; form-submit toast helper; `?toast=<key>` post-redirect reader + flag on 10 redirect actions.

**Out of scope:** converting sign-out; removing any inline `<FormError>`; toasting field-level Zod
errors; pending/loading toasts.

## Architecture / Approach

`toastMessage()` primitive (mirrors reference) + a `'use client'` `<ToastProvider>` mounted once in
the root layout. Imperative results flow through `useActionTransition.run(thunk, {successMessage})`.
Form results flow through `toastActionResult(result, {successMessage})` called in each `onSubmit`.
Redirect successes append `?toast=<key>`; a global `<ActionToast>` reader toasts on mount and strips
the param.

## Phases at a Glance

| Phase                   | Delivers                                        | Key risk                                         |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------ |
| 1. Foundation           | `toasts.ts` + mounted `<ToastContainer>`        | CSS import / client-boundary in server layout    |
| 2. Imperative seam      | hook toasts + all imperative sites migrated     | regressing optimistic-revert / AlertDialog flows |
| 3. Form seam            | `toastActionResult` helper wired into all forms | double-reporting success on return-only forms    |
| 4. Post-redirect reader | `?toast=` reader + flag on 10 redirect actions  | re-toast on refresh if param not stripped        |

**Prerequisites:** branch/worktree off current `main` (decide at implement time per the parallel-session isolation lesson).
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- `useSearchParams()` in the reader needs a `<Suspense>` boundary (Next 16) — handle in Phase 4.
- A redirect-action success toast must fire in exactly one place (the flag), never also in-handler.
- Migrating 5 imperative sites onto one hook must preserve each site's optimistic/dialog behavior.

## Success Criteria (Summary)

- Reorder failure shows a viewport-fixed error toast regardless of scroll (the origin bug, fixed).
- Create/save/delete note & subject confirm with a toast after navigation; no re-toast on refresh.
- Topic-check add/edit/delete, review rating, and subject assignment all confirm with a toast.
