# Action Feedback Toasts — Implementation Plan

## Overview

Add a uniform `react-toastify` feedback layer so every mutation surfaces its outcome: failures
**scream** (viewport-fixed error toast) and successes **confirm**. The trigger was a `reorderNote`
failure that reverted the UI with its only signal an off-screen `<FormError>` below 52 notes. The
design collapses ~18 scattered call sites onto three seams — one imperative hook, one form helper,
one post-redirect reader — so a new action cannot regress to silent.

## Current State Analysis

Full enumeration in `research.md`. Key facts:

- All 19 Server Actions return `ActionResultT` `{ success: true } | { success: false; error: string }` (`src/types/action.ts:2`) **except `signOut`** (`void` + `redirect`).
- **No single chokepoint.** `useAppForm` (`src/components/forms/hooks/form-hooks.ts:8`) is vanilla TanStack with no result awareness — every form hand-rolls `onSubmit { const r = await action(); if (!r.success) setFormError(r.error) }`.
- `useActionTransition` (`src/hooks/use-action-transition.ts:16`) already centralizes imperative result handling for review rating + topic-check delete — the natural seam to extend.
- 10 actions `redirect()` on success → the closure never resumes (Next throws `NEXT_REDIRECT`); post-redirect feedback already exists as `?deleted=1` → `<DeletedNotice/>` (`src/app/(auth-pages)/sign-in/page.tsx:33`, `src/features/auth/components/deleted-notice.tsx`).
- `react-toastify@11.1.0` installed (mirrored from `wykonczymy@^11.0.5`), not yet wired.

## Desired End State

Every mutation produces a toast. Errors toast **and** keep their existing inline `<FormError>`
(both channels). Successes toast: imperative + return-only forms toast in-handler; redirect actions
toast after navigation via a `?toast=<key>` flag. Verify by: dragging a note to reorder (success
toast), forcing a failure (error toast visible regardless of scroll), saving/deleting a note
(post-redirect success toast), and rating a review card (success toast).

### Key Discoveries:

- Imperative seam: `src/hooks/use-action-transition.ts:16` (`run(thunk)`).
- Form pattern repeats across 6 forms; all funnel `result` through a per-file `formError` `useState` + `<FormError>` near submit.
- Post-redirect pattern to generalize: `src/features/auth/components/deleted-notice.tsx` + `?deleted=1`.
- Forced-dark shell (`src/app/layout.tsx` `<html className="dark">`) → toasts use `theme: 'dark'`.
- Reference `toastMessage` wrapper: `/Users/konradantonik/workspace/yolo/wykonczymy/src/components/toasts.ts`.

## What We're NOT Doing

- **Not** converting `signOut` to a client handler (user decision: redirect is sufficient feedback; sign-out rarely fails). It remains the one knowingly-silent call site.
- **Not** removing any inline `<FormError>` (field-level Zod or form-level action error) — both channels stay.
- **Not** toasting field-level Zod validation errors (would fire per keystroke/blur).
- **Not** adding pending/loading toasts (the `toast.update` pattern) — out of scope; optimistic UI + transitions already cover pending state.
- **Not** changing any action's success/redirect semantics beyond appending a `?toast=` flag.

## Implementation Approach

Three seams, built foundation-first:

1. A `toastMessage` primitive + a globally-mounted `<ToastContainer>`.
2. Extend `useActionTransition` to toast (error + optional success message); migrate every imperative call site onto it so toasting lives in one hook.
3. A shared form helper consumed by each `onSubmit`; plus a generalized `?toast=<key>` post-redirect reader for the 10 redirect actions.

## Critical Implementation Details

- **Redirect kills the closure.** For the 10 redirect actions, `toast.success` in `onSubmit`/`onClick` is unreachable — `redirect()` throws `NEXT_REDIRECT` before it. Success for those MUST go through the `?toast=` flag (Phase 4). Error toasts for them are fine in-closure (the failure path returns normally, no redirect).
- **Avoid double success on return-only forms.** A form must toast success in exactly one place — the in-handler helper (Phases 2/3), never also via a flag.
- **`<ToastContainer>` is a client component.** Mount it through a `'use client'` wrapper that also imports the CSS, so the server root layout stays a server component.

## Phase 1: Toast Foundation

### Overview

Add the `toastMessage` primitive and mount a single dark-themed `<ToastContainer>` covering all routes. No call sites wired yet.

### Changes Required:

#### 1. Toast primitive

**File**: `src/components/toasts.ts` (new)

**Intent**: A thin wrapper over `react-toastify` mirroring the reference's `toastMessage`, so call sites use one project API (not raw `toast.*`). Dark theme, Bounce, bottom-center, 2s, no progress bar.

**Contract**: `export function toastMessage(message: string, type: ToastType = 'success', autoClose = 2000, position: ToastPosition = 'bottom-center'): void` and `export type ToastType = 'success' | 'error' | 'warning' | 'info'`. Mirror `/Users/konradantonik/workspace/yolo/wykonczymy/src/components/toasts.ts` options verbatim.

#### 2. Container mount

**File**: `src/components/toast-provider.tsx` (new, `'use client'`)

**Intent**: Render the configured `<ToastContainer>` and import the toastify CSS, so the root server layout can mount it without becoming a client component.

**Contract**: `export function ToastProvider()` → `<ToastContainer style={{ zIndex: 10001 }} />`; imports `'react-toastify/dist/ReactToastify.css'`.

**File**: `src/app/layout.tsx`

**Intent**: Mount `<ToastProvider/>` once in `<body>` so toasts render on every route.

**Contract**: add `<ToastProvider />` as the last child of `<body>`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build succeeds: `pnpm build`

#### Manual Verification:

- A temporary `toastMessage('hi','success')` call renders a dark, bottom-center toast on any page, then is removed.
- No hydration or console errors on load.

**Implementation Note**: pause for manual confirmation before Phase 2.

---

## Phase 2: Imperative Seam

### Overview

Make `useActionTransition` the single imperative toast point and migrate every imperative call site onto it.

### Changes Required:

#### 1. Extend the hook

**File**: `src/hooks/use-action-transition.ts`

**Intent**: After a thunk resolves, toast `result.error` on failure and an optional caller-supplied success message on success — keeping the existing inline `error` state for `<FormError>`.

**Contract**: `run(action: () => Promise<ActionResultT>, opts?: { successMessage?: string }): Promise<ActionResultT>`. On `!success`: `setError(error)` (unchanged) **and** `toastMessage(error, 'error')`. On success: if `opts.successMessage`, `toastMessage(opts.successMessage, 'success')`. **Returns the resolved `ActionResultT`** so callers that own optimistic state can revert on failure (see #2). Resolve the promise from inside `startTransition` (a deferred/`Promise` captured by the transition callback) so the returned result reflects the action outcome while the pending flag still tracks the transition. Backwards compatible — existing void-callers (`rating-buttons`, `delete-topic-check-button`) ignore the return.

#### 2. Migrate bare-`useTransition` call sites onto the hook

**Files**: `src/features/subjects/reorderable-note-list.tsx`, `src/features/notes/components/note-subject-picker.tsx`, `src/features/notes/delete-note-button.tsx`, `src/features/subjects/delete-subject-button.tsx`, `src/features/account/components/delete-account-dialog.tsx`

**Intent**: Replace each component's hand-rolled `useTransition` + `setError` with `useActionTransition().run(...)`, passing a per-site `successMessage`. Preserve existing behavior (optimistic state + revert in reorder/picker; AlertDialog flow in deletes; inline `<FormError>`).

**Optimistic revert (reorder + picker).** These two own local optimistic state (`setItems`/`setValue`) and snapshot `previous` before the write — the hook cannot own that. They consume `run`'s **returned result** to revert: snapshot `previous`, apply the optimistic update, then `const result = await run(() => action(args), { successMessage }); if (!result.success) setItems(previous)` (resp. `setValue(previous)`). The hook still owns `error`/`isPending`/the error+success toasts; only the state rollback stays caller-side. `note-subject-picker` drops its local `useTransition` and uses the hook's `isPending` to disable the Combobox.

**Contract**: each `run(() => action(args), { successMessage: '…' })`. Success messages (per-call-site, user decision): reorder → `'Order saved'`; assign-subject → `'Subject updated'`; delete-note → `'Note deleted'` (fires before redirect resolves — acceptable; redirect lands on `/notes`); delete-subject → `'Subject deleted'`; delete-account → none (terminal redirect/sign-out). For the redirect-on-success deletes, the success toast is optional here vs. the Phase-4 flag — **decision: use the Phase-4 `?toast=` flag for delete-note/delete-subject** so the toast survives navigation; pass NO `successMessage` for those two, only the error path. Reorder + assign-subject (return-only) toast success in-hook.

#### 3. Topic-check imperative sites already on the hook

**Files**: `src/features/review/rating-buttons.tsx`, `src/features/topic-checks/delete-topic-check-button.tsx`

**Intent**: Pass `successMessage` to the existing `run(...)` calls — they gain toasts with no structural change.

**Contract**: rating → `'Review recorded'`; delete-topic-check → `'Check deleted'`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Build succeeds: `pnpm build`

#### Manual Verification:

- Reorder a note → "Order saved" toast; force a failure → error toast visible even scrolled down (the original bug).
- Assign a subject via the picker → "Subject updated"; rate a review card → "Review recorded"; delete a topic check → "Check deleted".
- Existing optimistic revert + AlertDialog flows unchanged.

**Implementation Note**: pause for manual confirmation before Phase 3.

---

## Phase 3: Form Seam

### Overview

A shared helper every form `onSubmit` calls, so form action errors toast (keeping inline `<FormError>`) and the two silent-success forms confirm.

### Changes Required:

#### 1. Form-result helper

**File**: `src/components/forms/utils.ts` (extend) or a new `src/components/forms/toast-result.ts`

**Intent**: One function each `onSubmit` calls with the action result; toasts the error (and optional success message) without owning the inline `<FormError>` (the form keeps `setFormError`).

**Contract**: `export function toastActionResult(result: ActionResultT, opts?: { successMessage?: string }): boolean` — returns `result.success`. On failure: `toastMessage(result.error, 'error')`. On success with `successMessage`: `toastMessage(successMessage, 'success')`.

#### 2. Wire return-only / silent-success forms

**Files**: `src/features/topic-checks/topic-check-form.tsx` (create + edit), `src/app/(auth-pages)/reset-password/page.tsx`

**Intent**: Call `toastActionResult` in `onSubmit`. The two topic-check forms get `successMessage` (`'Check added'` / `'Check saved'`) — these are the silent successes. Keep `form.reset()`/`router.push` + inline `FormError`.

**Contract**: `if (!toastActionResult(result, { successMessage })) { setFormError(result.error); return }`.

#### 3. Wire redirect forms (error toast only)

**Files**: `src/features/notes/note-form.tsx`, `src/features/subjects/subject-form.tsx`, `src/app/(auth-pages)/sign-in/page.tsx`, `sign-up/page.tsx`, `update-password/page.tsx`

**Intent**: Route the failure branch through `toastActionResult` (error toast) + keep `setFormError`. Success rides Phase 4's flag (closure never resumes past `redirect()`), so pass no `successMessage` here.

**Contract**: `if (!toastActionResult(result)) { setFormError(result.error); return }`.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.

#### Manual Verification:

- Add/edit a topic check → success toast; trigger a form error (e.g. duplicate/invalid) → error toast + inline `FormError` both show.
- reset-password success path still shows its inline confirmation.

**Implementation Note**: pause for manual confirmation before Phase 4.

---

## Phase 4: Post-Redirect Success Reader

### Overview

Generalize the `?deleted=1` → `<DeletedNotice/>` pattern into a reusable `?toast=<key>` reader, and have the 10 redirect actions append the flag so create/save/delete/auth confirm after navigation.

### Changes Required:

#### 1. Toast key → message map

**File**: `src/components/toasts.ts` (extend) or `src/features/.../toast-keys.ts`

**Intent**: A closed `as const` map from short URL-safe keys to user-facing messages, so URLs carry a key (not raw copy) and messages stay centralized.

**Contract**: `export const TOAST_MESSAGES = { 'note-saved': 'Note saved', 'note-deleted': 'Note deleted', 'subject-saved': 'Subject saved', 'subject-deleted': 'Subject deleted', 'signed-in': 'Welcome back', 'account-deleted': 'Account deleted', … } as const`. Type `ToastKey = keyof typeof TOAST_MESSAGES`.

#### 2. Reader component

**File**: `src/components/action-toast.tsx` (new, `'use client'`)

**Intent**: On mount, read `?toast=<key>` from the URL, toast the mapped message once, and strip the param (so refresh/back doesn't re-toast). Generalizes `deleted-notice.tsx`.

**Contract**: reads `useSearchParams()`; if `toast` key is in `TOAST_MESSAGES`, `toastMessage(TOAST_MESSAGES[key], 'success')` in an effect, then strip **only** the `toast` param (NOT `router.replace(pathname)`, which would drop sibling params — e.g. the documented `?subjects=` notes filter that a redirect could land beside): `const next = new URLSearchParams(searchParams); next.delete('toast'); router.replace(next.size ? \`${pathname}?${next}\` : pathname)`. Mount once globally (root layout, beside `<ToastProvider/>`) inside a `<Suspense>` (useSearchParams requirement).

> **Note — the effect is intentional.** This is a toast-once-on-mount-from-URL + strip side effect (synchronizing with an external system: the URL), the allowed exception to react.md's "avoid useEffect" — NOT the banned derived-state-in-effect pattern. Add a one-line comment in the component saying so (and the `<Suspense>` requirement above), so the review fan-out / `/simplify` gate doesn't try to remove it. Same exception family as the timer-cleanup effect in `lessons.md`.

#### 3. Append the flag in redirect actions

**Files**: `src/features/notes/actions/{create-note,update-note,delete-note}.ts`, `src/features/subjects/actions/{create-subject,update-subject,delete-subject}.ts`, `src/features/auth/actions/{sign-in,sign-up,update-password}.ts`

**Intent**: On the success path, redirect to the existing target with `?toast=<key>` appended.

**Contract**: e.g. `redirect('/notes/' + id + '?toast=note-saved')`. `deleteNote` → `/notes?toast=note-deleted`. Keep `deleteAccount`'s existing `?deleted=1` → consider folding `DeletedNotice` into the new reader (`?toast=account-deleted`) and removing `deleted-notice.tsx`, OR leave as-is (smaller diff). **Decision: migrate `?deleted=1` to `?toast=account-deleted` and delete `deleted-notice.tsx`** — one mechanism, no dead component.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- `deleted-notice.tsx` removed and no dangling imports: `grep -r DeletedNotice src` returns nothing.

#### Manual Verification:

- Create a note → lands on the note with a "Note saved" toast; edit → "Note saved"; delete → lands on `/notes` with "Note deleted".
- Same for subjects. Sign-in → "Welcome back". Delete account → sign-in page shows "Account deleted".
- Refresh after landing does NOT re-toast (param stripped).

**Implementation Note**: feature code complete. Proceed to the per-slice review gate (review fan-out → `/simplify` → author tests → archive) per CLAUDE.md.

---

## Testing Strategy

Per CLAUDE.md, the test layer is authored **after** the review fan-out + `/simplify`, against the cleaned-up code.

### Unit Tests:

- `toastActionResult` returns `result.success` and calls `toastMessage` with the right type/message (mock `toastMessage`).
- `useActionTransition` toasts error on failure and success message on success (mock `toastMessage`).
- `TOAST_MESSAGES` key lookup in the reader.

### Integration / E2E (Playwright):

- **Reorder failure scream** (the origin bug): force a `reorderNote` failure → assert an error toast is visible.
- **Reorder success**: drag → "Order saved" toast.
- **Form success post-redirect**: create a note → assert "Note saved" toast on the destination; delete → "Note deleted" on `/notes`.
- **Silent-success form**: add a topic check → "Check added" toast.
- **No re-toast on refresh**: after a redirect-with-flag, reload → no toast, URL has no `?toast`.

## Performance Considerations

Negligible — one client container + an effect-driven reader. `<ToastContainer>` is a single portal; the reader only runs on URL change.

## Migration Notes

`?deleted=1` → `?toast=account-deleted`; `deleted-notice.tsx` deleted. No data migration.

## References

- Research: `context/changes/action-feedback-toasts/research.md`
- Reference toast pattern: `/Users/konradantonik/workspace/yolo/wykonczymy/src/components/toasts.ts`
- Imperative seam: `src/hooks/use-action-transition.ts:16`
- Post-redirect pattern to generalize: `src/features/auth/components/deleted-notice.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Toast Foundation

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 60a807c
- [x] 1.2 Linting passes: `pnpm lint` — 60a807c
- [x] 1.3 Production build succeeds: `pnpm build` — 60a807c

#### Manual

- [x] 1.4 Temporary `toastMessage` renders a dark bottom-center toast on any route — 60a807c
- [x] 1.5 No hydration or console errors on load — 60a807c

### Phase 2: Imperative Seam

#### Automated

- [x] 2.1 `pnpm typecheck` passes
- [x] 2.2 `pnpm lint` passes
- [x] 2.3 `pnpm build` succeeds

#### Manual

- [x] 2.4 Reorder success toast + failure error toast visible while scrolled
- [x] 2.5 Assign-subject / rating / topic-check-delete toasts fire
- [x] 2.6 Optimistic revert + AlertDialog flows unchanged

### Phase 3: Form Seam

#### Automated

- [ ] 3.1 `pnpm typecheck` passes
- [ ] 3.2 `pnpm lint` passes
- [ ] 3.3 `pnpm build` succeeds

#### Manual

- [ ] 3.4 Topic-check add/edit success toasts
- [ ] 3.5 Form error → error toast + inline FormError both show
- [ ] 3.6 reset-password inline confirmation still works

### Phase 4: Post-Redirect Success Reader

#### Automated

- [ ] 4.1 `pnpm typecheck` passes
- [ ] 4.2 `pnpm lint` passes
- [ ] 4.3 `pnpm build` succeeds
- [ ] 4.4 `DeletedNotice` removed, no dangling imports (`grep -r DeletedNotice src` empty)

#### Manual

- [ ] 4.5 Create/save/delete note + subject show post-redirect toasts
- [ ] 4.6 Sign-in + delete-account show toasts
- [ ] 4.7 Refresh after redirect does not re-toast (param stripped)
