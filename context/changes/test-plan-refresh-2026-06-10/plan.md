# Plan — test-plan refresh 2026-06-10

Doc-only refresh of `context/foundation/test-plan.md`. No product code, no new tests.
Grounding: `research.md` (this folder). Decisions confirmed with operator 2026-06-10:

- Token HTTP API → **convergence note under R1** (not a 9th risk row).
- R4 spend-loop gap → **document as known gap** (no Linear issue, no product code).

## Edit list (all in `context/foundation/test-plan.md`)

### §1 Strategy

- [ ] E1. Hot-spot scope line (l.37): note that `src/features/openrouter/` is now the heaviest hand-written AI churn (was absent). Keep scope definition intact.

### §2 Risk Map

- [ ] E2. R1 Source cell (l.49): refresh stale churn figures (subjects 67→110, auth 35→40) to current dominant dirs; this is freshness only.
- [ ] E3. R1 convergence note: add a short note (Risk Response Guidance R1 row or Abuse-lens paragraph) that the `/api/*` token surface rides the SAME RLS + minted-JWT path (IDOR = R1), is covered by `api-tokens.integration` / `api-routes.integration`, **but those specs are default-skipped** — the `pnpm test` gate does NOT exercise API-level IDOR (`pnpm test:integration` does).
- [ ] E4. R2 Source cell (l.50): review 33→72, review-events 19→29.
- [ ] E5. R3/R4 Source cells (l.51-52): note the surface is now not just "built" but substantially unit-tested (ai-schemas, sanitize-generated, prompts preview-equivalence, etc.); add the 2026-06-08/09 slices.
- [ ] E6. R4 detail: record that the per-request size ceiling exists (50k/10MB/100k) but there is NO call-count/repeat guard in code, so "cannot be looped to bypass it" is unmet by CODE; note BYOK + OpenRouter-credit-cap mitigation; the over-limit refusal is also untested.
- [ ] E7. R8 row (l.56): `midpoint.ts` fractional math is now unit-covered (`midpoint.test.ts`); the e2e reorder-degeneracy path remains uncovered. Correct "not yet covered" to that nuance.
- [ ] E8. Security-hardening pass bullets (l.62-68): correct "code fixes, not tests … still untested" — fixes (3) re-auth, (4) password-8, (5) CRLF now have regression tests (`delete-account.spec`, `auth-validate.test`, `contact-schema.test`); only (1) sign-up-neutral and (2) `runTableAction` generic-error remain untested.

### §3 Phased Rollout

- [ ] E9. Add an "Incidental coverage" note after the table: Phases 1–5 have NO dedicated rollout change folder yet (status literal stays `not started` for the parser), but substantial incidental coverage already exists per phase (cite research §2 table). Phase 4 = R3 mostly done / R4 untested; Phase 5 = encryption + delete-flow done / row-gone + leak-scan missing.
- [ ] E10. Correct the §3 footnote (l.100) claim that Phases 4–5 "remain not started … no longer gated" to reflect the incidental coverage + the R4 code gap.

### §4 Stack

- [ ] E11. Spec counts: "14 specs in src/**tests**" → 39; "17 specs in e2e/" → 22 (l.113-114).
- [ ] E12. Add default-skipped integration caveat: 2 of the 39 unit-dir specs are `RUN_INTEGRATION`-gated (`api-routes.integration`, `api-tokens.integration`), run only via `pnpm test:integration`.
- [ ] E13. Version spot-check: vitest ^4.0.18, @playwright/test ^1.60.0, ts-fsrs ^5.4.1, stryker ^9.6.1 — all confirmed current against package.json (no change). Bump no version cells.

### §6 Cookbook

- [ ] E14. §6.5 (AI generation surface) — replace "TBD" stub with what now exists (R3 unit specs) + the explicit R4 gap (over-limit refusal + repeat-guard untested/unbuilt).

### §8 Freshness Ledger

- [ ] E15. Bump "Strategy last reviewed" / "Stack versions last verified" / "AI-native tool refs last verified" to 2026-06-10.
- [ ] E16. Add a 2026-06-10 ledger line summarizing this refresh (counts, R3/R5 now partially covered, R4 gap recorded, token-API convergence note, default-skipped caveat).

## Out of scope (recorded, not done here)

- Writing any of the missing tests (R4 over-limit, R5 row-gone + leak scan, fixes (1)/(2) regression).
- Building an app-level rate/throughput guard for R4.
- Opening a 9th risk row or a Linear issue.

## Progress

- [x] 1.1 Apply refresh edits E2–E16 to test-plan.md (E1 skipped — redundant with §2 churn refresh) — 785cee2
- [x] 1.2 Slice review gate — doc-accuracy audit (accurate+consistent), 3 churn figures corrected, /simplify vacuously-0 (no source in diff), suite skipped-with-reason (zero code touched); operator approved both decisions — 785cee2

(Archive is the close-out action, run via /10x-archive — not a plan phase.)
