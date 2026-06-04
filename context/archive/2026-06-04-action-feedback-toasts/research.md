---
date: 2026-06-04T00:00:00Z
researcher: ex-Plant
git_commit: 92ce18faa89b8ff00477df12c75f2b0c9200ffcc
branch: main
repository: 10x_devs
topic: 'Global toast feedback wired through every mutation (errors + success)'
tags: [research, codebase, toasts, server-actions, react-toastify, forms]
status: complete
last_updated: 2026-06-04
last_updated_by: ex-Plant
---

# Research: Global toast feedback wired through every mutation

**Date**: 2026-06-04
**Researcher**: ex-Plant
**Git Commit**: 92ce18faa89b8ff00477df12c75f2b0c9200ffcc
**Branch**: main
**Repository**: 10x_devs

## Research Question

Build a uniform toast layer (react-toastify, errors **and** success) wired through **every**
mutation call site so a failure can never again die silently (the trigger: a `reorderNote` failure
reverted the UI with the only signal an off-screen `<FormError>` below 52 notes). Enumerate every
Server Action, how its result reaches the UI today, the existing seams to centralize on, and the
reference (`wykonczymy`) toast pattern to mirror.

## Summary

- **19 Server Actions** all return the `ActionResultT` envelope `{ success: true } | { success: false; error: string }` (`src/types/action.ts:2`), except **`signOut`** which returns `void` and just `redirect()`s.
- **react-toastify@11.1.0** is already installed (mirrored from `wykonczymy@^11.0.5`) but **not wired anywhere** (zero imports).
- **There is NO single chokepoint.** `useAppForm` (`src/components/forms/hooks/form-hooks.ts:8`) is vanilla TanStack `createFormHook` with no action/result awareness — every form hand-rolls `onSubmit { const result = await action(...); if (!result.success) setFormError(result.error) }`. Imperative call sites split between the shared `useActionTransition` hook and bare handlers.
- **Two real seams to converge on:** (1) `useActionTransition.run` (`src/hooks/use-action-transition.ts:16`) already centralizes imperative result-handling (review rating, topic-check delete) — the natural place to add toasts; (2) the per-`onSubmit` form closures.
- **The redirect problem:** 10 actions `redirect()` on success — control never returns to the closure (Next throws `NEXT_REDIRECT`), so a success toast cannot be fired in `onSubmit`/`onClick`. The codebase already solves post-redirect feedback with a **query flag**: `?deleted=1` → `<DeletedNotice/>` (`src/app/(auth-pages)/sign-in/page.tsx:33`). Generalize that, don't fight it.
- **Correction to a first-pass finding:** redirect-on-success actions are NOT silent on failure — `redirect()` throws only on the success branch, so on failure the closure still receives `{success:false}` and renders inline `<FormError>`. The genuine gaps are below.

### The actual gaps the slice must close

1. **Errors are inline-only and can be off-screen** — every failure renders via `<FormError>` inside the form/dialog body. For long pages (the reorder list under 52 notes) the user never sees it. A toast is viewport-fixed → this is the core fix.
2. **Silent successes** — 6 call sites return `{success:true}` with only `revalidatePath`, no user feedback: createTopicCheck, updateTopicCheck, deleteTopicCheck, rateTopicCheck, reorderNote, assignNoteSubject.
3. **sign-out has no failure path at all** — bare `<form action={signOut}>`, no client handler, `void` return (`src/features/auth/components/sign-out-button.tsx:16`).

## Detailed Findings

### Action return contracts (all under `src/features/*/actions/`)

Envelope is uniform `ActionResultT` except sign-out. Two wrappers normalize the `{data,error}`
PostgREST envelope into the discriminated result: `runTableAction` (`src/lib/supabase/run-table-action.ts:19`, returns `{success,data}`) and `runAuthAction` (`src/features/auth/run-auth-action.ts:13`).

**Redirect-on-success (10)** — success = navigation; failure returns `{success:false}` to the closure:
signIn, signUp, updatePassword, createNote, updateNote, deleteNote, createSubject, updateSubject,
deleteSubject, deleteAccount.

**Return-only (no redirect, 8)** — closure sees both branches:
resetPassword (custom success UI: `setSent(true)`), assignNoteSubject, reorderNote, rateTopicCheck,
createTopicCheck, updateTopicCheck, deleteTopicCheck. (resetPassword is the one form that already
surfaces success to the client.)

**Void + redirect (1):** signOut — `Promise<void>`, `redirect('/sign-in')`, no error channel.

### Call-site inventory (how results reach the UI today)

| #   | Call site                                                  | Action            | Form / Imperative                                        | Error today                                           | Success today                            |
| --- | ---------------------------------------------------------- | ----------------- | -------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| 1   | `(auth-pages)/sign-in/page.tsx:20`                         | signIn            | FORM                                                     | inline FormError                                      | redirect                                 |
| 2   | `(auth-pages)/sign-up/page.tsx:19`                         | signUp            | FORM                                                     | inline FormError                                      | redirect                                 |
| 3   | `(auth-pages)/reset-password/page.tsx:20`                  | resetPassword     | FORM                                                     | inline FormError                                      | **custom**: `setSent(true)`              |
| 4   | `(auth-pages)/update-password/page.tsx:18`                 | updatePassword    | FORM                                                     | inline FormError                                      | redirect                                 |
| 5   | `features/notes/note-form.tsx:88` (create)                 | createNote        | FORM                                                     | inline FormError                                      | redirect                                 |
| 6   | `features/notes/note-form.tsx:88` (edit)                   | updateNote        | FORM                                                     | inline FormError                                      | redirect                                 |
| 7   | `features/subjects/subject-form.tsx:29` (create)           | createSubject     | FORM                                                     | inline FormError                                      | redirect                                 |
| 8   | `features/subjects/subject-form.tsx:30` (edit)             | updateSubject     | FORM                                                     | inline FormError                                      | redirect                                 |
| 9   | `features/topic-checks/topic-check-form.tsx:40` (create)   | createTopicCheck  | FORM                                                     | inline FormError                                      | **SILENT** (`form.reset()` + revalidate) |
| 10  | `features/topic-checks/topic-check-form.tsx:39` (edit)     | updateTopicCheck  | FORM                                                     | inline FormError                                      | **SILENT** (`router.push` + revalidate)  |
| 11  | `features/notes/delete-note-button.tsx:56`                 | deleteNote        | IMPERATIVE (AlertDialog + useTransition)                 | inline FormError in dialog                            | redirect                                 |
| 12  | `features/subjects/delete-subject-button.tsx:55`           | deleteSubject     | IMPERATIVE (AlertDialog + useTransition)                 | inline FormError in dialog                            | redirect                                 |
| 13  | `features/topic-checks/delete-topic-check-button.tsx:52`   | deleteTopicCheck  | IMPERATIVE (**useActionTransition**)                     | inline FormError via hook                             | **SILENT** (row vanishes)                |
| 14  | `features/review/rating-buttons.tsx:28`                    | rateTopicCheck    | IMPERATIVE (**useActionTransition**)                     | inline FormError via hook                             | **SILENT** (next card streams)           |
| 15  | `features/subjects/reorderable-note-list.tsx:90`           | reorderNote       | IMPERATIVE (dnd onDragEnd + useTransition)               | inline FormError **+ optimistic revert** (off-screen) | **SILENT** (optimistic)                  |
| 16  | `features/notes/components/note-subject-picker.tsx:42`     | assignNoteSubject | IMPERATIVE (Combobox onChange + useTransition)           | inline FormError **+ optimistic revert**              | **SILENT** (optimistic)                  |
| 17  | `features/auth/components/sign-out-button.tsx:16`          | signOut           | IMPERATIVE (bare `<form action>`)                        | **NOTHING**                                           | redirect                                 |
| 18  | `features/account/components/delete-account-dialog.tsx:37` | deleteAccount     | IMPERATIVE (type-to-confirm AlertDialog + useTransition) | inline FormError in dialog                            | redirect → `?deleted=1` notice           |

### The form-hook seam (where toasts attach without double-reporting)

Two distinct error channels both render through `<FormError>` (`src/components/forms/form-components/form-error.tsx:7`):

1. **Field-level (Zod)** — `FormInput` reads `field.state.meta.errors` via `getFieldErrorText` (`src/components/forms/utils.ts:11`), rendered inline under each input. **Must stay inline** — these fire per keystroke/blur; toasting them would be noise.
2. **Form-level (action `{success:false}`)** — hand-managed `formError` `useState` set in `onSubmit`, rendered once near submit. **This is the toast target.**

`useActionTransition` (`src/hooks/use-action-transition.ts:16`) is the same form-level pattern factored out for imperative call sites — `run(thunk)` sets `error` on `{success:false}`. Adding `toast.error`/`toast.success` here instantly covers #13 and #14, and #11/#12/#15/#16/#18 if migrated onto it.

## Code References

- `src/types/action.ts:2` — `ActionResultT` discriminated union (the universal envelope)
- `src/lib/supabase/run-table-action.ts:19` / `src/features/auth/run-auth-action.ts:13` — PostgREST→result normalizers
- `src/hooks/use-action-transition.ts:16` — **imperative seam** (`run` thunk; add toasts here)
- `src/components/forms/hooks/form-hooks.ts:8` — `useAppForm` (vanilla, no result awareness — forms hand-roll)
- `src/components/forms/form-components/form-error.tsx:7` — shared inline error (keep field-level)
- `src/app/(auth-pages)/sign-in/page.tsx:33` + `src/features/auth/components/deleted-notice.tsx` — **query-flag post-redirect feedback** pattern to generalize for redirect-success toasts
- `src/app/layout.tsx` — root server layout, `<html className="dark">`; mount `<ToastContainer>` in `<body>`

## Architecture Insights

- **No chokepoint → enforceability is the design problem.** "Wire to all mutations" can't be a one-liner; it requires converging call sites onto shared seams: `useActionTransition` (imperative) + a form-submit helper/convention (forms) + a generalized query-flag reader (redirect successes). A new action must be hard to wire silently.
- **Avoid double-reporting:** route action-level errors to `toast.error` and drop the per-form `formError`/`<FormError message={formError}>` pair; **keep** `FormInput`'s field-level `<FormError>` (Zod). Decision to ratify in `/10x-plan-review`: replace inline form-level error with toast, vs. keep both.
- **Redirect successes** ride the `?flag=1` → notice pattern (server sets the param on redirect; a small client reader toasts on mount), NOT an in-closure `toast.success` (unreachable past `redirect()`).
- **Three-tier placement** (AGENTS.md "Project structure"): the toast helper is a non-domain primitive → `src/components/` (sibling to `forms/`, `layout/`). Mirror `wykonczymy/src/components/toasts.ts` `toastMessage(message, type, autoClose, position)`.

## Reference pattern to mirror (`wykonczymy`, react-toastify ^11.0.5)

`src/components/toasts.ts` — verbatim shape to copy (dark theme, Bounce, bottom-center, 2s, no progress bar):

```ts
import { Bounce, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
export type ToastType = 'success' | 'error' | 'warning' | 'info'
export function toastMessage(
  message: string,
  type: ToastType = 'success',
  autoClose = 2000,
  position = 'bottom-center',
) {
  toast[type](message, {
    position,
    hideProgressBar: true,
    autoClose,
    closeOnClick: true,
    pauseOnHover: false,
    draggable: true,
    progress: undefined,
    theme: 'dark',
    transition: Bounce,
  })
}
```

- Mount: `<ToastContainer style={{ zIndex: 10001 }} />` in the root layout `<body>` (server component is fine — it hydrates as a client portal). CSS import path `react-toastify/dist/ReactToastify.css` confirmed working under Next 16.
- Pending→resolve pattern (for long ops, optional here): `toast.info(msg,{autoClose:false})` → `toast.update(id,{render,type,autoClose})` (`wykonczymy/src/components/transfers/invoice-download-button.tsx`).

## Historical Context (from prior changes)

- `context/foundation/lessons.md` "URL-driven multiselect filter" + its **meta-rule**: this slice mirrors `wykonczymy` again — mirror the pattern faithfully (don't strip its documented options), and read the reference's comments before "simplifying".
- The query-flag feedback (`?deleted=1`) shipped in the archived S-05 `delete-account-and-data` change — reuse, don't reinvent.

## Open Questions (for /10x-plan)

1. **Error duplication policy:** replace per-form `formError`/`<FormError>` with `toast.error` (cleaner, one channel) vs. keep inline + also toast? Field-level Zod errors stay inline regardless.
2. **Migrate imperative call sites onto `useActionTransition`** (#11,12,15,16,18 currently use bare `useTransition`) so the toast lives in one hook — or add toasts per-site? Migration = enforceable single seam, but touches more files.
3. **Success-toast scope for redirect actions:** generalize `?flag` → a reusable `<ActionToast/>` mount reader, or accept that navigation is sufficient feedback for those and only toast the 6 silent-success sites? (User chose errors+success globally — leans toward generalizing.)
4. **sign-out:** convert to a client handler to get a failure toast, or leave (sign-out rarely fails, redirect is feedback)?
5. **Branch:** currently on `main` — slice needs its own branch; consider a worktree per the project's isolation lesson.
