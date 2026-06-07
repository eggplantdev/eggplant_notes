# Memory-Card State & Maturity Filters Implementation Plan

## Overview

Add two server-side, URL-driven, multiselect filters to the `/memory-cards` listing — **FSRS state** (New / Learning / Review / Relearning) and **maturity** (Mature / Young) — alongside the existing subject + `?q=` search filters. The work first generalizes the existing `SubjectFilter` into a reusable URL-multiselect component (3rd-consumer promotion), then layers the two new filters on top.

## Current State Analysis

- **The filter pipeline already exists and is battle-tested.** `getMemoryCardsList` (`queries.ts:53`) composes optional predicates inside a `filtered(head)` factory (`.in('subject_id', …)` + `searchOr`), runs through `runPaginatedQuery` with the 416-overflow fallback (lessons.md:155). Adding `.in('state', …)` and a maturity `stability` comparison is the same shape — a few lines.
- **`SubjectFilter` owns the hard client logic.** `subject-filter.tsx` implements two-mode selection (URL prop vs local state while the popover is open), debounce-batched commits, chips with removal, and pagination reset — over the dumb `MultiSelect` primitive (`multi-select.tsx`). It is hardcoded to the `subjects` URL key + "Subjects" copy.
- **`SubjectFilter` has two consumers today:** `memory-cards/page.tsx:48`-ish and `notes/page.tsx:48`. A true promotion refactors both.
- **The page reads/merges `searchParams` already.** `memory-cards/page.tsx` parses `?subjects=&q=&page=` and composes them; `buildUrlWithParams` (`build-url-with-params.ts`) merges overrides and deletes empty-string keys (the page-reset trick).
- **State and maturity are both plain columns.** `memory_cards.state` is a `smallint` (0–3, `FSRS_STATE_LABELS`); maturity is derived from `stability` via `MATURE_STABILITY_DAYS = 21` (`constants.ts`) — already used by `cards-overview.tsx:18` and the maturity chart. No migration, no computed column, no RPC.

## Desired End State

On `/memory-cards`, the filter row shows four controls: search, Subjects, **State**, **Maturity**. Picking states and/or maturity buckets re-queries the list server-side (RLS-scoped, paginated), composes with subject + `q`, resets to page 1, and is shareable/back-forward-safe via the URL. The "Cards overview" chart stays whole-deck (ignores filters). The notes page keeps its identical subject-filter behavior, now running through the same generalized component.

Verify: select State = "Review" → only Review-state cards show; add Maturity = "Mature" → narrows to Review AND `stability ≥ 21`; clear all → full list; the count/footer reflect the filtered total; Back restores the prior selection.

### Key Discoveries:

- `SubjectFilter` is the logic, `MultiSelect` is the primitive — generalize the former, keep the latter (`subject-filter.tsx`, `multi-select.tsx:37`).
- `getMemoryCardsList`'s `filtered(head)` factory is the single composition point for predicates (`queries.ts:64`).
- `buildUrlWithParams` already clears empty keys and is how `page` resets (`build-url-with-params.ts:11`).
- Maturity = `stability ≥ 21`; **Young includes brand-new cards** (stability 0) by design — State filter covers New separately (`constants.ts:5`).
- `MemoryCardListItemT` already selects `state` (`types.ts:29`); `stability` is NOT selected by the list query but is only needed for the WHERE clause, not the projection — no type change needed for maturity.
- The filter row only renders when `total > 0 || isFiltered` (`memory-cards/page.tsx`) — the new params must feed `isFiltered`.
- E2E selector discipline: `data-testid`, scope-then-target, never `.first()` (lessons.md:119).

## What We're NOT Doing

- No migration, computed column, RPC, or schema change.
- No faceted counts (showing "(12)" per option) — out of scope.
- No third maturity bucket for New — New is covered by the State filter; maturity stays Mature/Young.
- No change to the "Cards overview" chart (stays whole-deck) or to `getDueQueue`/dashboard.
- No change to State-filter granularity (four raw FSRS states, matching the chart — no collapsed buckets).
- No new filter behavior on the notes page beyond the like-for-like refactor onto the generalized component.

## Implementation Approach

Phase 1 is a behavior-preserving refactor: extract `UrlMultiSelectFilter` carrying all of `SubjectFilter`'s URL/debounce/two-mode/chips logic, parameterized on URL key + label + placeholder + options; rewrite `SubjectFilter` as a thin wrapper (or replace its usages) and confirm notes + memory-cards behave identically. Phase 2 adds the two predicates to `getMemoryCardsList`, parses + validates the new params on the page, and renders two `UrlMultiSelectFilter` instances. Phase 3 (E2E) is authored only after the per-slice review gate + `/simplify`, per CLAUDE.md.

## Phase 1: Generalize the filter component (refactor-only)

### Overview

Extract the reusable URL-multiselect from `SubjectFilter` with no user-visible change, and route subjects (on both pages) through it.

### Changes Required:

#### 1. New generic URL-multiselect

**File**: `src/components/ui/url-multi-select-filter.tsx`

**Intent**: Move all of `SubjectFilter`'s logic — two-mode selection, debounce-batch, chips + removal, pagination reset, timer cleanup — into a generic component parameterized on the URL param key and copy. Non-domain (it knows only "a multiselect bound to a URL param"), so it lives in `components/ui/` beside `multi-select.tsx`, not in a feature.

**Contract**: `export function UrlMultiSelectFilter({ paramKey, options, selectedValues, placeholder, searchPlaceholder, emptyMessage, label }: UrlMultiSelectFilterPropsT)`. `paramKey: string` (e.g. `'subjects'`, `'state'`, `'maturity'`), `selectedValues: string[]` (server-derived from the URL, the source of truth), `options: MultiSelectOptionT[]`. Internals are a verbatim lift of `subject-filter.tsx:30-130` with `subjects` → `paramKey` and the "Subjects" strings → props. Keep the `DEBOUNCE_MS = 400`, the `commit` that passes `{ [paramKey]: next.join(','), page: '' }` to `buildUrlWithParams`, the open/flush/reseed handlers, and the cleanup-only `useEffect`. Carries `data-testid={`filter-${paramKey}`}` on the trigger for E2E.

#### 2. Reduce `SubjectFilter` to a thin wrapper

**File**: `src/features/subjects/components/subject-filter.tsx`

**Intent**: Keep the subject-specific entry point (so callers and the subjects feature's public surface are unchanged) but delegate to the generic. Preserves the `{ options, selectedIds }` prop contract its two callers pass.

**Contract**: `SubjectFilter({ options, selectedIds })` → renders `<UrlMultiSelectFilter paramKey="subjects" selectedValues={selectedIds} options={options} placeholder="Subjects" searchPlaceholder="Search subjects…" emptyMessage="No subjects found." label="Subjects" />`. All prior logic removed from this file (now in the generic).

### Success Criteria:

#### Automated Verification:

- Typegen + typecheck pass: `pnpm exec next typegen && pnpm typecheck`
- Linting passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- Notes page subject filter behaves exactly as before (pick/clear/chips/back-forward/pagination reset).
- Memory-cards page subject filter behaves exactly as before.
- No visual change to either filter control.

**Implementation Note**: After automated verification passes, pause for manual confirmation that both pages' subject filters are unchanged before proceeding to Phase 2.

---

## Phase 2: Add state + maturity filters

### Overview

Layer the two new server-side filters onto the listing using the Phase 1 generic.

### Changes Required:

#### 1. Query predicates

**File**: `src/features/memory-cards/queries.ts`

**Intent**: Extend `getMemoryCardsList` to filter by FSRS state and maturity bucket, composed with the existing subject/q predicates inside `filtered(head)` so both query variants (ranged + 416-fallback count) stay identical.

**Contract**: Add to the `opts` type: `states?: number[]` and `maturity?: ('mature' | 'young')[]`. In `filtered`, after the subject `.in`: `if (states?.length) query = query.in('state', states)`. For maturity, import `MATURE_STABILITY_DAYS` and apply only when exactly one bucket is selected (both or neither = no constraint): mature-only → `.gte('stability', MATURE_STABILITY_DAYS)`; young-only → `.lt('stability', MATURE_STABILITY_DAYS)`. `stability` stays out of the projection (WHERE-only).

#### 2. Param parsing + validation

**File**: `src/app/(protected)/memory-cards/page.tsx`

**Intent**: Read `?state=` and `?maturity=` from `searchParams`, validate/coerce them, pass to `getMemoryCardsList`, and feed the `isFiltered` flag so the empty-state copy and the filter-row visibility stay correct.

**Contract**: Widen the `searchParams` type with `state?: string` and `maturity?: string`. Parse `state` as comma-split integers kept only if `0–3` (drop junk); parse `maturity` as comma-split values kept only if `'mature'|'young'`. Pass `states`/`maturity` into the list query. `isFiltered = selectedIds.length > 0 || Boolean(q) || states.length > 0 || maturity.length > 0`.

#### 3. State + Maturity filter controls

**File**: `src/app/(protected)/memory-cards/page.tsx` (filter row)

**Intent**: Render two `UrlMultiSelectFilter` instances in the existing filter row next to `SearchFilterInput` + `SubjectFilter`.

**Contract**: State control: `paramKey="state"`, options = `FSRS_STATE_LABELS.map((label, i) => ({ value: String(i), label }))`, `selectedValues` = the validated state strings, label/placeholder "State". Maturity control: `paramKey="maturity"`, options = `[{ value: 'mature', label: 'Mature' }, { value: 'young', label: 'Young' }]`, label/placeholder "Maturity". Import `FSRS_STATE_LABELS` from `@/features/memory-cards/constants`.

#### 4. Cookbook touch (if test-plan flow active)

**File**: `context/foundation/test-plan.md` (§6) — only if it exists and the project is tracking the rollout there.

**Intent**: Note the new filter surface as a covered/edge area. Skip silently if no test-plan.md.

**Contract**: One-line §6 entry pointing at the Phase 3 spec; no-op if the file is absent.

### Success Criteria:

#### Automated Verification:

- Typegen + typecheck pass: `pnpm exec next typegen && pnpm typecheck`
- Linting passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- Selecting one or more States narrows the list to those states; count/footer reflect the filtered total.
- Selecting Mature shows only `stability ≥ 21`; Young shows only `< 21` (incl. new cards); selecting both = no maturity constraint.
- State + Maturity + Subjects + search compose (AND) correctly.
- Clearing a filter (chip X or empty selection) restores; changing a filter resets to page 1.
- Back/Forward restores prior selections; a deep-linked `/memory-cards?state=2&maturity=mature` loads pre-filtered.
- Empty-state copy shows "No memory cards match your search." when a filter yields zero.

**Implementation Note**: After automated verification passes, pause for manual confirmation, then run the per-slice review gate (parallel review fan-out → `/simplify`) BEFORE authoring Phase 3.

---

## Phase 3: E2E coverage

### Overview

One Playwright spec proving the new filter surface end-to-end against a fresh production build. Authored only after the review gate + `/simplify`.

### Changes Required:

#### 1. Filter E2E spec

**File**: `e2e/memory-card-filters.spec.ts`

**Intent**: Self-seed cards in distinct states/maturities through the real UI (or accept the seed deck), then assert that applying State and Maturity filters narrows the visible rows and that combining them ANDs.

**Contract**: Fresh-per-test sign-up via `e2e/helpers.ts` (`uniqueEmail`) — mutation spec, no shared session (lessons.md:38). Locate filters via `data-testid="filter-state"` / `filter-maturity`; scope-then-target list rows, never `.first()` (lessons.md:119). Assert on the rendered count / specific seeded prompts (data you control), not on copy. New cards are `state=0` immediately after creation, so a freshly-created card is deterministically New + Young — usable as the assertion anchor without waiting on FSRS.

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm test:e2e` (local Supabase stack up; fresh prod build on port 3100)
- Full unit suite passes: `pnpm test`
- Typecheck + lint + build green: `pnpm exec next typegen && pnpm typecheck && pnpm lint && pnpm build`

#### Manual Verification:

- Reverting a Phase 2 predicate locally makes the spec fail (negative sanity check).

---

## Testing Strategy

### Unit Tests:

- The maturity bucket→predicate mapping (both/neither = no constraint) is the one piece of branching logic worth a tiny unit test if extracted to a pure helper; otherwise it's exercised by the E2E. Keep it inline unless review asks to extract.

### Integration / E2E Tests:

- Phase 3's spec is the integration signal: seed distinct cards → apply filters → assert narrowing + AND composition.

### Manual Testing Steps:

1. `supabase start`, `pnpm dev`, sign in as `test@gmail.com` (real-content deck).
2. `/memory-cards` → pick State = Review → list narrows; footer total updates.
3. Add Maturity = Mature → narrows further; clear → restores.
4. Deep-link `/memory-cards?state=2,3&maturity=mature` → loads pre-filtered.
5. Confirm notes page subject filter still works (Phase 1 regression check).

## References

- Change identity: `context/changes/memory-card-state-maturity-filters/change.md`
- Generalization source: `src/features/subjects/components/subject-filter.tsx`
- Primitive: `src/components/ui/multi-select.tsx:37`
- Query composition point: `src/features/memory-cards/queries.ts:64`
- URL helper: `src/lib/utils/build-url-with-params.ts:11`
- Maturity/state constants: `src/features/memory-cards/constants.ts:1`
- Lessons applied: lessons.md:62 (URL multiselect two-mode/debounce), :119 (E2E selectors), :155 (paginated 416)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Generalize the filter component

#### Automated

- [x] 1.1 Typegen + typecheck pass: `pnpm exec next typegen && pnpm typecheck` — d822d67
- [x] 1.2 Linting passes: `pnpm lint` — d822d67
- [x] 1.3 Build passes: `pnpm build` — d822d67

#### Manual

- [x] 1.4 Notes page subject filter behaves exactly as before — d822d67
- [x] 1.5 Memory-cards page subject filter behaves exactly as before — d822d67
- [x] 1.6 No visual change to either filter control — d822d67

### Phase 2: Add state + maturity filters

#### Automated

- [x] 2.1 Typegen + typecheck pass: `pnpm exec next typegen && pnpm typecheck` — 34fd528
- [x] 2.2 Linting passes: `pnpm lint` — 34fd528
- [x] 2.3 Build passes: `pnpm build` — 34fd528

#### Manual

- [x] 2.4 State filter narrows the list; count/footer reflect filtered total — 34fd528
- [x] 2.5 Maturity Mature/Young/both behave correctly (Young incl. new) — 34fd528
- [x] 2.6 State + Maturity + Subjects + search compose (AND); filter change resets to page 1 — 34fd528
- [x] 2.7 Back/Forward + deep-link pre-filtered load work — 34fd528
- [x] 2.8 Zero-match empty-state copy shows — 34fd528

### Phase 3: E2E coverage

#### Automated

- [x] 3.1 New spec passes: `pnpm test:e2e` — a892b23
- [x] 3.2 Full unit suite passes: `pnpm test` — a892b23
- [x] 3.3 Typecheck + lint + build green — a892b23

#### Manual

- [x] 3.4 Reverting a Phase 2 predicate makes the spec fail (negative sanity check) — a892b23
