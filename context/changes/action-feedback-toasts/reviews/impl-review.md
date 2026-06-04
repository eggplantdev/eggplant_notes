<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Action Feedback Toasts

- **Plan**: context/changes/action-feedback-toasts/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-06-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

All four phases shipped exactly as planned. The three-seam design (imperative hook, form helper,
post-redirect reader) is fully realized: every imperative call site routes through
`useActionTransition`, every form through `toastActionResult`, and all 10 redirect actions append a
`?toast=<key>` flag read by the single globally-mounted `<ActionToast>`. `react-toastify` is imported
only in the two seam files (`toasts.ts`, `toast-provider.tsx`) — no raw `toast.*` leaked into a call
site, so the single-API discipline holds and a future action cannot regress to silent. `signOut`
remains the one knowingly-silent site (per the locked decision). `deleted-notice.tsx` is removed with
zero dangling references. Automated criteria (`pnpm typecheck`, `pnpm lint`, `pnpm build`, and the
`grep -r DeletedNotice src` empty check) all pass.

## Findings

### F1 — Manual verification checkboxes for Phases 3 & 4 left unchecked

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/action-feedback-toasts/plan.md:330-347
- **Detail**: All automated checkboxes (1.x–4.x) are `[x]` with commit shas, and `change.md` status is
  `implemented`. But the Manual verification items for Phase 3 (3.4 topic-check add/edit success toast;
  3.5 form error → error toast + inline FormError both show; 3.6 reset-password inline confirmation)
  and Phase 4 (4.5 create/save/delete note+subject post-redirect toasts; 4.6 sign-in + delete-account
  toasts; 4.7 no re-toast on refresh) remain `- [ ]`. The code clearly implements all of these paths
  correctly (verified by reading), but the plan's own manual-confirmation gate ("pause for manual
  confirmation") was not stamped. This is the per-slice review gate's job to confirm before archive —
  the E2E layer (authored after `/simplify`) will lock 4.5–4.7 in; 3.6 (reset-password inline
  confirmation) and the dual-channel assertion of 3.5 are the only items not obviously covered by a
  planned Playwright spec.
- **Fix**: During the test-authoring phase of the gate, ensure the Playwright specs cover the
  redirect-toast + no-re-toast-on-refresh paths (already in the plan's E2E list) and add an assertion
  that a form error shows BOTH the toast and the inline `<FormError>` (3.5). Then check the manual
  boxes (or convert each to its covering automated spec id).
- **Decision**: PENDING

### F2 — `toasts.ts` mixes three concerns (type union + message map + wrapper fn)

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/toasts.ts:1-46
- **Detail**: The file holds the `ToastType`/`ToastPosition` type unions, the `TOAST_MESSAGES` `as const`
  map + `ToastKey` type, and the `toastMessage()` function. The project typescript rule favors one
  concern per file (types → `types.ts`, constants → `constants.ts`, helpers → their own file), and the
  plan itself offered `src/features/.../toast-keys.ts` as an alternative home for the map. The chosen
  single-file layout was an explicitly-allowed plan branch ("`toasts.ts` (extend) or …toast-keys.ts"),
  the file is small (46 lines), well-commented, and the three concerns are tightly cohesive (all are
  "the toast vocabulary"), so this is a deliberate, defensible co-location — flagged only for the
  cohesion record, not as a defect. `module-cohesion-audit` (run in the gate fan-out) is the place to
  ratify or split it.
- **Fix**: Accept as-is (cohesive, small, plan-sanctioned), or — if the cohesion audit prefers it —
  move `TOAST_MESSAGES` + `ToastKey` into a sibling `toast-keys.ts` and keep `toasts.ts` as the wrapper
  - type unions only.
- **Decision**: PENDING

### F3 — Inline `style={{ zIndex: 10001 }}` on `<ToastContainer>`

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/toast-provider.tsx:11
- **Detail**: The styling rule discourages inline `style` where a utility could express it. Here the
  value is passed as the `style` prop of a third-party `<ToastContainer>` (a single magic z-index to
  sit above shadcn overlays), it was specified verbatim in the plan's Contract
  (`<ToastContainer style={{ zIndex: 10001 }} />`), and the comment documents the intent. A Tailwind
  `z-*` utility cannot be applied to react-toastify's portal root via className without targeting its
  internal class, so the inline prop is the pragmatic path. Not a real violation — noted so
  `tailwind-v4-audit` (gate fan-out) doesn't re-flag it as a surprise.
- **Fix**: Accept as-is (third-party component prop, plan-specified, documented). If a lint/audit
  insists, lift `10001` to a named `@theme` z-index token and reference it — but that is churn for one
  magic number.
- **Decision**: PENDING
