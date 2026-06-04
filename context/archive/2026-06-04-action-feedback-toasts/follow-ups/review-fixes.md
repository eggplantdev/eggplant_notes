# action-feedback-toasts — deferred review follow-ups

Findings from the slice-review gate (2026-06-04) that are real but out of this slice's cleanup scope.

## O2 — `?toast=<key>` redirect literals aren't type-checked against `ToastKey`

- **Source:** `feature-first-structure` review (observation O2).
- **What:** The 10 redirect actions emit raw string literals (e.g. `redirect('/notes?toast=note-deleted')` in `src/features/{notes,subjects,auth,account}/actions/*.ts`). They do **not** import `ToastKey`/`TOAST_MESSAGES`, so a typo (`?toast=note-svaed`) compiles fine and then silently shows no toast — the reader's `if (!(key in TOAST_MESSAGES)) return` guard swallows it. Mildly against the slice's "a mutation can't go silent" intent, though only for the redirect-success confirmation (a nice-to-have, not the error scream).
- **Why deferred:** A fix means a typed URL helper (e.g. `toastRedirect(path, key: ToastKey)`) or typing each literal, touching all 10 action files — additive surface beyond this slice's cleanup. Keys are simple and exercised by the manual/E2E paths.
- **Suggested fix:** add a tiny `withToast(path: string, key: ToastKey): string` helper next to `TOAST_MESSAGES` and use it at each `redirect(...)` site, so a bad key fails `pnpm typecheck`.
