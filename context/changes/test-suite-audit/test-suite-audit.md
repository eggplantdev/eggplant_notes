# Test-suite audit — over-testing / cost×signal triage

> Read-only audit of the existing 31 specs (14 unit + 17 e2e) against the
> cut/merge criteria in `context/foundation/test-plan.md`. Produced 2026-06-06
> via a 3-agent parallel fan-out, triaged in the main thread.
>
> **Status: report only — no test files changed.** This is the action list
> for a future focused pruning pass (its own change / branch + green suite).

## Why this exists

`/10x-test-plan` (m3l1) gave the project its first risk-first rubric for "what
is worth testing." This audit applies that rubric _backwards_ to the tests we
already have: the plan adds coverage going forward; this prunes tests that cost
more than their signal. Criteria (from the plan):

- **C1 negative-space (CUT)** — tests §7-excluded surface: presentational/UI
  polish (toast visuals/copy/animation, motion, nav shell, glow, celebration
  dialog), seed/sample-data _internals_, markdown render _fidelity_. (Third-party
  _integration_ — our usage of FSRS/Supabase/Shiki — is NOT excluded.)
- **C2 redundant (MERGE)** — another spec asserts the same behavior.
- **C3 wrong-layer (DOWNGRADE)** — e2e testing logic a cheaper unit/integration
  test would catch; e2e is the slowest layer (full prod build per run).
- **C4 low-signal (CUT/REWRITE)** — implementation-mirror / oracle problem,
  cosmetic or trivial-constant assertion, asserts DOM presence not the effect.
- **C5 orphan (FLAG)** — traces to no §2 risk.

Risk map referenced: R1 cross-user leak (RLS); R2 recall loop reschedule/due-set;
R3 AI output validation (unbuilt); R4 token spend (unbuilt); R5 credential leak
(unbuilt); R6 silent mutation failure.

## A. High-confidence cuts — §7 negative-space / pure presentational

| Spec / case                                                             | Layer | Action           | Why                                                                                   |
| ----------------------------------------------------------------------- | ----- | ---------------- | ------------------------------------------------------------------------------------- |
| `e2e/memory-cards-overview.spec.ts`                                     | e2e   | CUT (whole file) | recharts SVG render + sr-only count — chart cosmetics, no risk (C1/C4)                |
| `e2e/notes.spec.ts` → subject-control placement                         | e2e   | CUT (case)       | DOM-presence: control hidden on read / shown in edit — no data effect (C1)            |
| `e2e/memory-cards.spec.ts` → deferred-add-form                          | e2e   | CUT (case)       | `.cm-content` mount/collapse counting — UI lazy-mount cosmetics (C1/C4)               |
| `e2e/notes.spec.ts` → unknown-fence fallback (S-13)                     | e2e   | CUT (case)       | markdown render fidelity (token-span counts) — explicitly §7-excluded (C1)            |
| `src/__tests__/dashboard-heatmap-matrix.test.ts` → `countToLevel` block | unit  | TRIM             | implementation-mirror of a trivial threshold table (C4); keep one date-placement case |
| `src/__tests__/toast-result.test.ts` → `TOAST_MESSAGES` map block       | unit  | TRIM             | trivial-constant assertion (C4); the result→branch cases stay (they serve R6)         |

## B. Layer downgrades — coverage MOVED cheaper, not deleted (best ROI)

| Spec / case                                                 | From → To                  | Why                                                                                               |
| ----------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `e2e/list-search.spec.ts` → pagination + tail               | e2e → integration          | 105-row insert + full prod build to assert pagination arithmetic + the 416 out-of-range edge (C3) |
| `e2e/list-search.spec.ts` → sidebar filter                  | e2e → unit                 | pure client-side in-memory string filter, no auth/DB (C3)                                         |
| `e2e/create-note-with-checks.spec.ts` → empty-Q blocks save | e2e → unit                 | pure Zod/form validation (C3)                                                                     |
| `e2e/auth.spec.ts` → too-short password                     | e2e → unit                 | pure Zod validation (C3)                                                                          |
| `e2e/daily-goal.spec.ts` → invalid goal rejected            | e2e → unit                 | pure Zod validation (C3)                                                                          |
| `e2e/create-note-with-checks.spec.ts` → zero-checks         | MERGE into the 2-card test | same RPC, note-only branch already exercised (C2)                                                 |
| `e2e/notes.spec.ts` → list Edit/Delete shortcuts            | REWRITE (trim)             | mostly nav/click-routing (C1); keep only the delete-removes-row persisted assert                  |

## C. Overrides — where the main-thread triage pushed back on the agents

- **`e2e/dashboard.spec.ts` — agent said CUT all 3 tests; verdict: TRIM, not CUT.**
  `src/app/(protected)/dashboard/page.tsx` is the single highest-churn file
  (29 commits/30d). Drop the 371-cell grid-count + DOM-presence asserts, but
  **keep one thin "due-count reflects reality" assertion** — high churn + zero
  e2e is how a silent dashboard regression ships.
- **`src/__tests__/sample-data-remap.test.ts` — agent said CUT (§7 seed internals); verdict: KEEP.**
  It asserts the **`user_id` remap** — that loaded sample rows are scoped to the
  _current_ user. A bug there is not a demo glitch; it is an **R1 isolation edge**
  (rows mis-scoped to another user). Straddles §7-excluded "seed internals" and
  the #1 risk. Recommend keep. (Decision deferred to operator — flagged, not dropped.)
- **`src/__tests__/goal-crossing.test.ts` — agent said CUT; verdict: CUT-low-stakes.**
  Feeds the celebration dialog (§7), so cutting is defensible; worst failure is a
  popup firing twice. Cut or keep — negligible either way.

## D. Risk-map gaps — NOT "cut a test"; §2 is missing a risk (→ `--refresh` candidates)

The agents flagged these as orphan (C5). They are real guards whose absence from
§2 is a plan gap, not test waste:

1. **Stored XSS (today, not future).** `e2e/notes.spec.ts` guards that raw
   `<script>`/`<img>` in a note body stays inert (rehype-raw tripwire). §2 has no
   XSS row — untrusted-input (R3) covers only the _AI_ path; user-authored markdown
   is a live injection surface now. → add a §2 risk row on `--refresh`.
2. **Subject/note ordering integrity.** `e2e/subjects.spec.ts` has CRUD/nav/**reorder**
   tests tracing to no risk, yet `src/features/subjects/` is 3rd-highest churn
   (67/30d) and reorder corruption was a real interview-Q1 candidate. → add an
   ordering-integrity risk row on `--refresh`; keep the tests.

## Net effect if A + B are applied

- ~4 e2e cases cut (A) + 5 downgraded to unit/integration + 1 merged (B) + 2 unit
  blocks trimmed.
- **Zero risk-coverage lost** — set B _moves_ coverage to a cheaper layer; set A
  removes only §7-excluded / presentational asserts.
- Measurable e2e wall-clock win concentrated in `list-search.spec.ts` (105-row
  insert + prod build for pagination math) and the chart/heatmap render specs.

## Specs confirmed KEEP (high-value, no change)

- `e2e/isolation.spec.ts` — R1 #1 guardrail; bidirectional cross-user denial at all
  three cascade levels. Not shallow. Untouchable.
- `e2e/review.spec.ts` — R2 north-star recall loop with persisted-effect assertions
  - cross-account review RLS.
- `e2e/memory-cards.spec.ts` (RLS isolation case) — R1 cross-user card denial.
- `e2e/delete-account.spec.ts` — R1 account lifecycle + post-delete auth denial.
- `e2e/notes.spec.ts` (raw-HTML inert) — stored-XSS guard (see D.1).
- `e2e/card-to-note.spec.ts` — R2 card→note differentiator from a due card.
- `src/__tests__/review-scheduling.test.ts` — R2 directional oracle (Again < Good),
  the §6.1 reference test; highest-value unit spec.
- `src/__tests__/card-schema.test.ts`, `notes-schema.test.ts` — schema contracts +
  the documented `z.guid` seed-id regression (turns red if reverted to `z.uuid`).
- `src/__tests__/{daily-goal,dashboard-streak,week-count,format-review-status,pagination,build-url-with-params,midpoint,auth-validate}.test.ts`
  — cheap pure-logic guards, real regressions, no mirror.

## Notes for whoever picks this up

- Mislabel: `src/__tests__/dashboard-streak.test.ts` actually tests
  `countDistinctReviewedOn`, not streak logic (streak lives in `daily-goal.test.ts`).
  Rename when touched.
- The two `count*` specs (`countDistinctReviewedOn` vs `countReviewsInWeek`) look
  redundant but assert opposite semantics (distinct-cards vs raw-events) — correctly
  separate, do NOT merge.
- Downgrades (set B) need new unit/integration homes written before the e2e cases
  are deleted — do not delete-then-write, or there's a coverage gap window.
