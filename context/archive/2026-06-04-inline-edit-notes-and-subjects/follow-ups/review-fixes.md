# S-14 follow-ups (deferred from the review gate)

## 1. E2E suite blocked by pre-existing S-16 toast-assertion debt (NOT S-14)

- **What:** `pnpm test:e2e` is red on the base (`eb394bf`) because S-16
  (`action-feedback-toasts`, commits up to `fb55de2`) changed the auth redirects
  to carry a query — `redirect('/dashboard?toast=signed-up')` (sign-up),
  `?toast=signed-in` (sign-in), `?toast=password-updated` (update-password) — but
  the E2E assertions still expect the bare path:
  - `e2e/helpers.ts:28` (`signUp`) — `toHaveURL('/dashboard')` (shared; blocks ~10 specs)
  - `e2e/auth.spec.ts` — 7× `toHaveURL('/dashboard')`
  - `e2e/auth.setup.ts` — shared-session setup, same assertion
- **Fix (one mechanical change per site):** tolerate the query, e.g.
  `toHaveURL(/\/dashboard(\?|$)/)`.
- **Status:** Deferred by owner decision — to be tackled as a dedicated pass
  _after_ S-14 is archived (it is S-16's test debt, and a parallel S-16 session
  may own the shared files; fixing it here risks a merge collision).
- **S-14's own specs ARE verified:** both new specs
  (`notes.spec.ts` "in-place edit … (S-14)", `subjects.spec.ts` "in-place edit … (S-14)")
  were confirmed **green** locally via a throwaway `signUp` patch (reverted, not
  shipped). They will pass in CI the moment the helper above tolerates `?toast`.
  Progress rows **1.4 / 2.4** are left unchecked only because the committed suite
  can't reach them past the stale shared helper — not because S-14's flows fail.

## 2. (perf, low) Subject edit mode re-renders the full note document

- **What:** `subjects/[id]/page.tsx` renders the whole member-note list (each note
  through the server-only Shiki `RenderMarkdown`) even when `?edit` is active and
  the user is editing the header. The note page correctly gates its `RenderMarkdown`
  behind `!isEditingNote`; the subject page does not.
- **Why not fixed in the gate:** the plan **locks** the note list staying visible
  in edit mode (plan Intent line 107, Manual criterion 2.6 "note list stays") — the
  `/simplify` rule is to skip findings that change intended behavior.
- **If revisited:** gate only the expensive `RenderMarkdown` loop (keep the cheap
  indexed `getNotesForSubject` read in the existing `Promise.all`), preserving the
  "list stays" UX while skipping the off-screen highlight work on the edit render.
