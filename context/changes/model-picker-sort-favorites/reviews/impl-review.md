# Review gate — model-picker-sort-favorites

Date: 2026-06-08. Run as the CLAUDE.md per-slice gate: parallel 4-check fan-out →
triage → `/simplify` → tests → archive. Scoped strictly to the slice's openrouter
files (the rest of the branch diff is an unrelated parallel-session refactor).

## Fan-out verdicts

- **`/10x-impl-review` (correctness/drift/patterns):** APPROVED — 0 critical, 2 warnings, 3 observations. All automated criteria green; git scope matches the planned file list (no creep). New actions faithfully mirror `set-model.ts`/`list-models.ts` (auth → validateInput → isAllowedModel → scoped UPDATE → maybeSingle → "Connect first" guard → revalidatePath). `sortModels` matches contract; star button correctly `stopPropagation`+`preventDefault` so cmdk `onSelect` doesn't fire. Verified the load-bearing assumption: the OAuth-callback upsert (`src/app/api/openrouter/callback/route.ts`) does NOT name `favorite_models`, so the column DEFAULT seeds new accounts and reconnect leaves pins untouched.
- **`/tailwind-v4-audit`:** CLEAN — 0 findings on `model-select.tsx`. Uses theme tokens + the v4 `property-(--var)` shorthand; no `var()`-in-brackets, no inline `style`, no arbitrary bracket values.
- **`feature-first-structure`:** PASS — deletion test clean (`rm -rf src/features/openrouter/` leaves no orphans); zero cross-feature internal imports (consumers go through `GenerateDialog`, never reach `ModelSelect`/`credential.ts`/the action files); `src/lib/supabase/types.ts` column add is correct infra-tier placement.
- **`/module-cohesion-audit`:** CLEAN — 0 splits. `models.ts` is acceptably cohesive (one "model-catalog domain": the type, its derived seed/fallback/defaults, and pure helpers over the same shape). `model-select.tsx` exports only the component. Seam to watch (not now): if `models.ts` grows, cleave pricing formatting first.

## Findings & dispositions

| ID  | Finding                                                                                                                        | Disposition                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Optimistic favorite-toggle revert restored a stale `previous` snapshot → a concurrent toggle of another id could be clobbered. | **Fixed** (`f9f046d`) — revert functionally by re-flipping the id against live state (toggle is its own inverse).                                                                                     |
| F2  | Toggle uses app-code read-modify-write vs the spec's atomic `array_append`/`array_remove`.                                     | **Kept + documented** (`f9f046d`) — plan §3 sanctioned this; a "toggle" needs membership to pick the op so the single-statement win is marginal; one row per user makes the TOCTOU window irrelevant. |
| F3  | `formatModelPricing` flags "Variable pricing" on either axis; `sortModels` checks the sorted axis only.                        | **Fixed** (`f9f046d`) — added a comment: the negative sentinel is all-or-nothing (both axes), so the two checks agree.                                                                                |
| F4  | First-load `Promise.all` has no catch (`loaded` stays false on reject).                                                        | **Skipped** — inherited pre-existing shape (catalog-only load had it); both actions are internally error-safe; out of slice scope.                                                                    |
| F5  | Descending sort shipped despite the spec listing it as a non-goal; "Recommended" group dropped.                                | **Skipped** — already documented in plan Phase-4 "Design evolved during implementation" note + Progress rows.                                                                                         |

## `/simplify` (2 applied, 3 proposed, 3 dismissed)

- **Applied** (`f9f046d`): removed dead `RECOMMENDED_MODEL_IDS` export (zero consumers); fixed stale "Recommended group" doc-comment on `RECOMMENDED_MODELS`.
- **Proposed (held, not applied):** `hasVariablePricing(model)` predicate to dedup the two sentinel checks; extract the shared ~25-line auth+envelope of `set-model.ts`/`toggle-favorite-model.ts` into `updateCredentialColumn`; `useMemo` the `pinned`/`rest` render derivation (marginal at 341 models / single user).
- **Dismissed:** array-toggle one-liner extraction (would couple action↔UI); routing the UPDATE through `runMaybeSingle` (contract mismatch — throws + returns row|undefined vs the soft `ActionResultT`); parallelizing `isAllowedModel`+`getCredentialRow` (both cached, no gain).

## Verification

Full suite green after all gate fixes: `pnpm typecheck`, `pnpm lint`, `pnpm test` (156), `pnpm build`. Manual picker verification (rows 3.4, 4.5–4.10) driven live via Playwright — see plan Progress. E2E deliberately deferred (plan + `test-plan.md`; headless E2E can't get a connected-OpenRouter credential).
