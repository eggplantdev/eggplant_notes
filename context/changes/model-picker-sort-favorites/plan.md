# Model picker — sort + favorites Implementation Plan

## Overview

Make the shared OpenRouter model picker (`ModelSelect`) more robust by adding two capabilities that ship to every model-selection surface at once:

1. **Sort** the catalog by **input cost**, **output cost**, or **name** (the "filter by cost" ask).
2. **Favorites** — let the user star models from the 300+ catalog; a "Favorites" group renders above the curated "Recommended" group.

Both live entirely inside `ModelSelect`, so the settings default picker and the per-generate dialog inherit them with **zero consumer changes**.

## Current State Analysis

- **`src/features/openrouter/models.ts`** — `OpenRouterModelT` already carries `inputPrice`, `outputPrice` (per-token USD), `label`, `inputModalities`. Pure helpers `normalizeModels`, `filterModels`, `formatPricePerM` live here and are unit-tested (`src/__tests__/openrouter-models.test.ts`). Curated `RECOMMENDED_MODELS` (6) + `RECOMMENDED_MODEL_IDS`.
- **`src/features/openrouter/components/model-select.tsx`** — cmdk combobox. Lazy-loads the catalog via the `listOpenRouterModels` server action on first popover-open into local `catalog` state (`models.ts:55-69`). Splits into "Recommended" (curated order) + "All models" (`localeCompare` by label, `models.ts:71-78`). Shows `formatPricePerM(in) · formatPricePerM(out)` per row once `loaded`. **No sort control, no favorites.**
- **`src/features/openrouter/actions/list-models.ts`** — read-only server action bridging the client picker to the server-cached catalog. Pattern to mirror for favorites read.
- **`src/features/openrouter/actions/set-model.ts`** — the default-model write action: auth → `validateInput(z.object({ modelId }))` → async `isAllowedModel` guard → scoped `UPDATE … .eq('user_id', user.id)` → `maybeSingle` → `revalidatePath('/settings')` → `ActionResultT`. **Pattern to mirror for the favorites toggle.**
- **`src/features/openrouter/credential.ts`** — `getCredentialRow` is the React-`cache()`d single-row read (selects `user_id, model, key_ciphertext, key_iv, key_auth_tag`). Add `favorite_models` to this select.
- **`src/features/openrouter/catalog.ts`** — `isAllowedModel(id)` allowlist guard over the live catalog. Reused unchanged by the toggle action.
- **`supabase/migrations/20260607153000_openrouter_credentials.sql`** — the table + RLS (owner-scoped select/insert/update/delete) + `moddatetime` trigger. New migration adds the column; existing update policy already covers the new column.
- **Consumers of `ModelSelect`:** `settings-model-select.tsx` (settings default) and `generate-dialog.tsx` (per-run override, wrapped by `topic-generator`, `generate-cards-button`, `import-panel` across 4 pages). **None change** — favorites is self-loaded, sort is local UI state.

## Desired End State

Opening any model picker, the user can:

- Pick a **sort mode** (Name / Input $ / Output $); the lists reorder accordingly, cheapest-first when a price sort is active.
- **Star/unstar** any model; starred models appear in a "Favorites" group at the top, persisted across sessions and visible on every model-select surface.

Verify: in Settings → AI, open the picker, sort by input price (cheapest first), star two models → they appear under "Favorites"; reload the page and reopen → favorites persist; open the generate dialog on a note → the same favorites + sort are available.

### Key Discoveries:

- `ModelSelect` already self-loads the catalog (`model-select.tsx:61-69`) — favorites self-load is the same pattern, so no prop threading.
- Sort logic is pure and belongs beside `filterModels` in `models.ts` — directly unit-testable and Stryker-eligible (the `mutate` glob in `stryker.config.json` already lists pure modules).
- The star button must live inside the cmdk `CommandItem` and `stopPropagation`, or tapping it would select the model (cmdk `onSelect`).
- Favorites is global per-user state (identical on every surface), so self-loading is both simpler and the more correct model than per-consumer props.

## What We're NOT Doing

- No descending sort variants (Input $ ↓ / Output $ ↓) — three modes only (Name, Input ↑, Output ↑).
- No numeric max-price threshold or price-tier preset chips (the rejected cost-filter alternatives).
- No second persisted default for the file/vision surface; `DEFAULT_OPENROUTER_FILE_MODEL` stays hardcoded.
- No per-feature defaults, no favorites cap, no separate favorites table.
- No consumer/page changes — the feature is confined to the `openrouter` feature folder.

## Implementation Approach

Bottom-up, each phase independently verifiable:

1. **Schema** — add the `favorite_models` column + reset the local DB.
2. **Pure sort logic** — `ModelSortT` + `sortModels` in `models.ts`, TDD with unit tests.
3. **Server actions** — `listFavoriteModels` (read) + `toggleFavoriteModel` (write); extend `getCredentialRow`.
4. **Picker UI** — sort control + favorites group + star toggle + self-load, wired into `model-select.tsx`.

## Phase 1: Schema — `favorite_models` column

### Overview

Add a per-credential `favorite_models` array. RLS already scopes the row to its owner; the existing update policy covers the new column; the FK cascade tears it down on account delete.

### Changes Required:

#### 1. New migration

**File**: `supabase/migrations/<timestamp>_openrouter_favorite_models.sql` (timestamp must sort after `20260607153000`)

**Intent**: Add a non-null text-array column defaulting to empty so existing rows backfill cleanly and reads never see null.

**Contract**: `alter table openrouter_credentials add column favorite_models text[] not null default '{}';` plus a short header comment matching the style of `20260607153000_openrouter_credentials.sql` (what the column holds, that it shares the row's RLS + cascade). No new policy.

### Success Criteria:

#### Automated Verification:

- [ ] Migration applies cleanly: `supabase db reset`
- [ ] Column exists: `supabase db reset` completes with no error and the seed (`seed.sql`) still loads (it doesn't touch the new column).
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:

- [ ] After `supabase db reset`, the two seed accounts still log in and Settings → AI renders.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Pure sort logic in `models.ts`

### Overview

Add the sort type and a pure, non-mutating `sortModels` helper next to `filterModels`. TDD — write the failing test first.

### Changes Required:

#### 1. Sort type + helper

**File**: `src/features/openrouter/models.ts`

**Intent**: Provide a single comparator-driven sort the picker applies to every group. Pure so it's unit-testable and Stryker-eligible.

**Contract**:

- `export type ModelSortT = 'name' | 'input' | 'output'`
- `export function sortModels(models: OpenRouterModelT[], sort: ModelSortT): OpenRouterModelT[]` — returns a new array (no mutation). `'name'` → `label.localeCompare`. `'input'` → ascending `inputPrice`, tie-break `label.localeCompare`. `'output'` → ascending `outputPrice`, tie-break `label.localeCompare`.

#### 2. Unit tests

**File**: `src/__tests__/openrouter-models.test.ts`

**Intent**: Cover the three modes plus the price tie-break (equal prices fall back to name order).

**Contract**: A `describe('sortModels')` block with: name ordering; input-price ascending; output-price ascending; tie-break on equal price → label order; input does not mutate the source array.

#### 3. Stryker glob

**File**: `stryker.config.json`

**Intent**: Keep mutation coverage honest for the new pure module.

**Contract**: Add `"src/features/openrouter/models.ts"` to the `mutate` array (it isn't listed yet, though it's already unit-covered).

### Success Criteria:

#### Automated Verification:

- [ ] New tests fail before the helper exists, pass after: `pnpm test openrouter-models`
- [ ] Full unit suite passes: `pnpm test`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:

- [ ] None — pure logic, fully covered by unit tests.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 3.

---

## Phase 3: Favorites server actions + read path

### Overview

A read action (`listFavoriteModels`) and a write action (`toggleFavoriteModel`), plus extending the cached credential read to include the column. Mirror the existing `list-models.ts` / `set-model.ts` patterns exactly.

### Changes Required:

#### 1. Extend the credential read

**File**: `src/features/openrouter/credential.ts`

**Intent**: Make `favorite_models` available to the read action without a second round-trip.

**Contract**: Add `favorite_models` to the `.select(...)` string in `getCredentialRow`. No type export change required unless a typed accessor is added.

#### 2. Read action

**File**: `src/features/openrouter/actions/list-favorite-models.ts` (new)

**Intent**: Client-callable bridge so the picker pulls the caller's favorites on popover-open, mirroring `list-models.ts`.

**Contract**: `'use server'`; `export async function listFavoriteModels(): Promise<string[]>` — reads `getCredentialRow()`, returns `data?.favorite_models ?? []`. No mutation.

#### 3. Toggle action

**File**: `src/features/openrouter/actions/toggle-favorite-model.ts` (new)

**Intent**: Add/remove a model id from the caller's favorites, allowlist-guarded and user-scoped, mirroring `set-model.ts`.

**Contract**: `'use server'`; `toggleFavoriteModel(input: unknown): Promise<ActionResultT>` (the shared `ActionResultT` in `src/types/action.ts` is payload-less — `{ success:true } | { success:false; error }` — so no data payload; the component reconciles favorites from its own optimistic local state). Steps: `getCurrentUser` (else not-authenticated); `validateInput(z.object({ modelId: z.string().min(1) }))`; `if (!(await isAllowedModel(modelId))) return { success:false, error:'Unknown model' }`; read current `favorite_models` (from `getCredentialRow` or a fresh select); compute next = remove if present else append; `UPDATE openrouter_credentials SET favorite_models = next WHERE user_id = user.id` (RLS also scopes), `.select('favorite_models').maybeSingle()`; `!data` → `{ success:false, error:'Connect OpenRouter first.' }`; `revalidatePath('/settings')`; return `{ success:true }`.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Unit suite still green: `pnpm test`

#### Manual Verification:

- [ ] In a `node`/server context or via the UI in Phase 4, toggling a known model id persists across `getCredentialRow` reads; an unknown id is rejected; calling without a connected credential returns the "Connect OpenRouter first." error.

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 4.

---

## Phase 4: Picker UI — sort control, Pinned group, star toggle, self-load

### Overview

Wire everything into `model-select.tsx`: a sort field+direction control, a self-loaded "pinned" set (the star) shown as a top **Pinned** group, and per-row star toggle. No consumer changes.

> **Design evolved during implementation (user feedback):** (a) the hardcoded "Recommended" group was **dropped** — the top group is purely the user's starred picks, labelled **Pinned**; the curated 6 become the DB-seeded starting pins (Phase 1 follow-up migration `20260608100741_seed_favorite_models_default.sql` sets the column default + backfills empty rows). (b) Sort gained a **direction** toggle (asc/desc) shown as a segmented field control + an Asc/Desc button — one-directional sort was rejected. (c) Router/dynamic models report a **negative sentinel price**; show "Variable pricing" (via `formatModelPricing`) and sort them last.

### Changes Required:

#### 1. Sort field + direction control

**File**: `src/features/openrouter/components/model-select.tsx`

**Intent**: Let the user reorder the catalog by a field and a direction; apply one comparator uniformly to both groups.

**Contract**: Local `const [sort, setSort] = useState<ModelSortT>('name')` + `const [sortDir, setSortDir] = useState<SortDirT>('asc')`. A `SegmentedToggle` (reuse `@/components/ui/segmented-toggle`) for the field (Name / Input $ / Output $) plus an Asc/Desc `Button` toggle, under a "Sort by" label, above `CommandList`. Apply `sortModels(group, sort, sortDir)` to each rendered group. cmdk still re-ranks on text query.

#### 2. Self-load favorites + optimistic toggle

**File**: `src/features/openrouter/components/model-select.tsx`

**Intent**: Own favorites internally, loaded alongside the catalog, toggled optimistically.

**Contract**: Local `const [favorites, setFavorites] = useState<string[]>([])`. In `handleOpenChange`'s first-open load (the existing `startLoad`), also `listFavoriteModels()` — run it in parallel with `listOpenRouterModels()` via `Promise.all`. A `toggleFavorite(id)` handler: optimistically update `favorites` (remove if present else add), call `toggleFavoriteModel({ modelId: id })`, and on failure revert + `toastActionResult` (import from `@/components/forms/toast-result`). The star renders once `loaded`.

#### 3. Pinned group + grouping

**File**: `src/features/openrouter/components/model-select.tsx`

**Intent**: Render a "Pinned" group (the user's stars) above "All models"; no hardcoded "Recommended".

**Contract**: Derive two disjoint lists from `filterModels(catalog, filter)`: `pinned` = models whose id ∈ `favorites`; `rest` = everything else. Render `CommandGroup heading="Pinned"` (only when non-empty) above `CommandGroup heading="All models"`. Each sorted via `sortModels(list, sort, sortDir)`. `RECOMMENDED_MODEL_IDS` is no longer used for grouping (only as the DB seed + offline catalog fallback).

#### 4. Per-row star toggle + variable pricing

**File**: `src/features/openrouter/components/model-select.tsx`

**Intent**: Toggle a pin from any row without selecting the model; show variable pricing sanely.

**Contract**: In `renderItem`, add a star `Button` (lucide `Star`, filled when starred) inside the `CommandItem`; its `onClick` must `e.stopPropagation()` + `e.preventDefault()` then `toggleFavorite(m.id)` (plus `onPointerDown` stopPropagation) so cmdk's `onSelect` doesn't fire. Render the price via `formatModelPricing(m)` (shows "Variable pricing" for the negative sentinel). Keep the `(default)` tag.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Unit suite passes: `pnpm test`
- [ ] Production build passes: `pnpm build`

#### Manual Verification:

- [ ] Settings → AI → open picker: sort toggles between Name / Input $ / Output $ and the list reorders (cheapest-first on price sorts).
- [ ] Star two models → they appear under a "Favorites" group at the top; the star reflects state; tapping the star does NOT select the model.
- [ ] Reload the page, reopen the picker → favorites persist.
- [ ] Open the generate dialog on a note (and the PDF import dialog) → the same favorites + sort are available; selecting a model still works; the per-run override is unchanged.
- [ ] With no model starred, "Recommended" still shows the curated set (no empty "Favorites" group).

**Implementation Note**: After automated verification passes, pause for human confirmation. Then proceed to the per-slice review gate (CLAUDE.md): review fan-out → `/simplify` → tests → `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- `sortModels`: name order; input-price ascending; output-price ascending; tie-break on equal price → name; non-mutation of input. (Phase 2.)

### Integration / E2E:

- Light/deferred per `context/foundation/test-plan.md` — the favorites toggle is a thin allowlisted write over an owner-scoped row; sort is pure UI. If an E2E is added later, drive it through `/10x-e2e` against the settings picker (star → reload → assert persisted).

### Manual Testing Steps:

1. `supabase db reset`, `pnpm dev`, log in as `test@gmail.com`.
2. Settings → AI: open picker, cycle sort, confirm reorder.
3. Star/unstar models; confirm the Favorites group and star state.
4. Reload; confirm persistence.
5. Open a generate dialog (note/card) and the PDF import dialog; confirm favorites + sort present and selection still works.

## Migration Notes

- New column is `not null default '{}'` — existing rows backfill to empty automatically; no data migration needed.
- Local apply is `supabase db reset` (rebuilds both seed accounts; wipes E2E cruft) per AGENTS.md. Don't re-apply `seed.sql` standalone.

## References

- Design spec: `docs/superpowers/specs/2026-06-08-model-picker-sort-favorites-design.md`
- Catalog self-load pattern: `src/features/openrouter/components/model-select.tsx:61-69`
- Write-action pattern to mirror: `src/features/openrouter/actions/set-model.ts`
- Read-action pattern to mirror: `src/features/openrouter/actions/list-models.ts`
- Allowlist guard: `src/features/openrouter/catalog.ts:39-42`
- Existing unit tests: `src/__tests__/openrouter-models.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema — favorite_models column

#### Automated

- [x] 1.1 Migration applies cleanly: `supabase db reset` — d374dd6
- [x] 1.2 Column exists and seed still loads after `supabase db reset` — d374dd6
- [x] 1.3 Type checking passes: `pnpm typecheck` — d374dd6

#### Manual

- [x] 1.4 Seed accounts log in; Settings → AI renders after reset — d374dd6

### Phase 2: Pure sort logic in models.ts

#### Automated

- [x] 2.1 New sortModels tests fail before, pass after: `pnpm test openrouter-models` — 15cfef3
- [x] 2.2 Full unit suite passes: `pnpm test` — 15cfef3
- [x] 2.3 Type checking passes: `pnpm typecheck` — 15cfef3
- [x] 2.4 Linting passes: `pnpm lint` — 15cfef3

### Phase 3: Favorites server actions + read path

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — bb6d3a8
- [x] 3.2 Linting passes: `pnpm lint` — bb6d3a8
- [x] 3.3 Unit suite still green: `pnpm test` — bb6d3a8

#### Manual

- [ ] 3.4 Toggle persists across reads; unknown id rejected; not-connected returns the connect error

### Phase 4: Picker UI — sort, favorites group, star toggle, self-load

#### Automated

- [x] 4.1 Type checking passes: `pnpm typecheck`
- [x] 4.2 Linting passes: `pnpm lint`
- [x] 4.3 Unit suite passes: `pnpm test`
- [x] 4.4 Production build passes: `pnpm build`

#### Manual

- [ ] 4.5 Sort field (Name/Input $/Output $) + Asc/Desc direction reorder the list both ways
- [ ] 4.6 Star adds to the Pinned group; star tap does not select the model
- [ ] 4.7 Pins persist across reload
- [ ] 4.8 Generate dialog + PDF import dialog show pins + sort; selection still works
- [ ] 4.9 Router models show "Variable pricing" (not $-1000000) and sort last on price
- [ ] 4.10 A freshly connected account shows the 6 seeded pins; All models lists the rest
