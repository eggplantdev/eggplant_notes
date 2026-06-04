---
change_id: action-feedback-toasts
title: Global toast feedback wired through every mutation (errors + success)
status: plan_reviewed
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

Motivation: a reorder mutation failed **completely silently** — the optimistic UI reverted with no
signal to the user, and the only `FormError` rendered off-screen below 52 notes. We need failures to
_scream_ and successes to confirm, uniformly, across the whole app.

Decisions locked before planning:

- **Library:** `react-toastify@11.1.0` — already installed, mirrored from the `wykonczymy` reference
  stack (its `src/components/toasts.ts` `toastMessage()` wrapper + `<ToastContainer>` pattern, dark
  theme, Bounce transition). Mirror that pattern; don't re-roll.
- **Scope:** errors **and** success. Every failed mutation → error toast; every successful one →
  a confirmation toast ("Saved", "Deleted", "Reordered", …).
- **Coverage:** wired through **all** Server Action mutations / call sites — not a one-off. The plan
  must enumerate every mutation entry point (notes, subjects, topic-checks, review, account, reorder,
  auth) and define ONE uniform mechanism so a new action can't regress to silent failure.

Out of scope: the dnd hydration mismatch and the seed-UUID `z.uuid()` bug — both fixed separately as
standalone bugfixes before this slice.

Resolved decisions (post-research, locked before /10x-plan):

- **Error channel:** keep the existing inline `<FormError>` AND also toast on failure (both). Field-level
  Zod errors stay inline only (no toast on keystroke).
- **Wiring depth:** converge ALL imperative call sites onto the shared `useActionTransition` hook
  (`src/hooks/use-action-transition.ts`) — migrate the bare-`useTransition` sites (delete-note,
  delete-subject, reorder, subject-picker, account-delete) onto it so success+error toasts live in
  ONE seam and a future action can't regress to silent. Forms toast via a parallel form-submit helper.
- **Redirect-success actions** (10): generalize the existing `?deleted=1`→`DeletedNotice` query-flag
  into a reusable post-redirect toast reader (in-closure `toast.success` is unreachable past `redirect()`).

Full enumeration + seams in `research.md`. Remaining plan-level calls: success-toast scope for the
6 silent-success sites, sign-out handling, and branch/worktree setup (currently on `main`).
