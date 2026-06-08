# Model picker: sort + favorites — design

**Date:** 2026-06-08
**Feature:** Make the OpenRouter model picker more robust — sort the catalog by cost (input/output) or name, and let the user curate a favorites set. Both ship in the shared `ModelSelect`, so every model-selection surface inherits them.

## Problem

The picker (`src/features/openrouter/components/model-select.tsx`) works but is thin:

- The 300+ catalog can only be searched by text (cmdk). You cannot order it by **input cost** or **output cost** — the prices are shown per row but you can't rank by them.
- There is a single persisted default model (`openrouter_credentials.model`) and a static curated `RECOMMENDED_MODELS` group. The user cannot curate their own short list of go-to models from the full catalog.

## Scope (and non-goals)

In scope:

- A **sort toggle** in the shared `ModelSelect`: Name A→Z (default), Input price low→high, Output price low→high.
- A **favorites** set: the user stars models from the catalog; a "Favorites" group renders above "Recommended". Persisted per credential.

Non-goals (deliberately cut — YAGNI for the 2-day MVP window):

- Sort descending variants (↓). Three ascending/name modes only.
- Numeric max-price threshold or tier-preset chips (the alternative cost-filter UX was rejected in favor of sort).
- Per-feature defaults or a second persisted default for the file/vision surface. The hardcoded `DEFAULT_OPENROUTER_FILE_MODEL` stays as-is.
- A favorites cap or separate favorites table.

## Data model

Add one column to `openrouter_credentials`:

```sql
alter table openrouter_credentials
  add column favorite_models text[] not null default '{}';
```

- New migration file under `supabase/migrations/` (timestamped, follows the existing `20260607153000_openrouter_credentials.sql` conventions).
- Existing RLS policies already scope the whole row to its owner — no new policy needed.
- Favorites share the credential's lifecycle: meaningless without a connected key, torn down by the same `auth.users` FK cascade on account delete. No extra teardown.

## Server layer

`ModelSelect` self-loads favorites (it already self-loads the catalog), so favorites flow through dedicated read/write actions rather than props.

- **New write action** `src/features/openrouter/actions/toggle-favorite-model.ts` → `toggleFavoriteModel({ modelId })`:
  - Mirrors `set-model.ts`: auth check, `validateInput` with `z.object({ modelId: z.string().min(1) })`, async `isAllowedModel` allowlist guard, `UPDATE … .eq('user_id', user.id)` scoped write, `maybeSingle`, `revalidatePath('/settings')`, returns plain `ActionResultT` (the shared type is payload-less; the picker reconciles favorites from its own optimistic local state).
  - Toggle semantics: if `modelId` is already in `favorite_models`, remove it (`array_remove`); otherwise append (`array_append`). Read-modify-write on the row in app code keeps it consistent with the existing action style.
- **New read action** `src/features/openrouter/actions/list-favorite-models.ts` → `listFavoriteModels(): Promise<string[]>` — reads the caller's `favorite_models` (via `getCredentialRow`), returns `[]` when not connected. Read-only bridge so the client picker can pull favorites on popover-open, exactly like `list-models.ts` does for the catalog.
- **Read path:** extend `getCredentialRow` select to include `favorite_models`. `getOpenRouterStatus` is unchanged — favorites no longer travel through page status.

## Pure logic (`models.ts`)

- New `export type ModelSortT = 'name' | 'input' | 'output'`.
- New pure helper `sortModels(models: OpenRouterModelT[], sort: ModelSortT): OpenRouterModelT[]`:
  - `'name'` → `localeCompare` on `label` (the current "All models" behavior).
  - `'input'` → ascending `inputPrice`, tie-break on `label`.
  - `'output'` → ascending `outputPrice`, tie-break on `label`.
  - Non-mutating (returns a new array). Lives beside `filterModels`/`normalizeModels` — same purity contract, unit-testable, Stryker-eligible.

## Shared `ModelSelect` component

`ModelSelect` is consumed by exactly two surfaces — `settings-model-select.tsx` (the settings default picker) and `generate-dialog.tsx` (the per-generate override). Putting sort + favorites in the shared component ships both features to both surfaces at once. **No consumer changes** — both sort (local UI state) and favorites (self-loaded) are fully internal to `ModelSelect`.

**Favorites are self-loaded, not threaded.** Favorites is global per-user state (identical on every surface), unlike `value`/`onChange` which legitimately differ per surface. So `ModelSelect` owns favorites internally: it `listFavoriteModels()` on first popover-open (parallel with the catalog `listOpenRouterModels()` it already loads) into local state, and calls `toggleFavoriteModel` directly on a star tap, updating local state optimistically and reverting on failure. This confines the whole feature to the `openrouter` folder and avoids plumbing props through 7 files.

Behavior:

- **Sort control** rendered in the popover above the list (a compact segmented/cycling control). Local `useState<ModelSortT>` defaulting to `'name'` — per-open UI state, **not** persisted. Until the catalog loads, prices are `0`, so Name is the correct default.
- **Sort applies uniformly** to every group (Favorites, Recommended, All models) using one `sortModels(..., sort)` comparator. (cmdk still re-ranks by relevance once the user types a query — the sort governs the un-queried order.)
- **Groups**, top to bottom:
  1. **Favorites** — `models` whose id is in `favoriteModels`. Rendered only when non-empty.
  2. **Recommended** — the curated `RECOMMENDED_MODEL_IDS` (minus any already shown under Favorites, to avoid duplication). The no-favorites fallback.
  3. **All models** — the remainder.
- **Star toggle** per row: a small button inside each `CommandItem` that calls `onToggleFavorite(m.id)` and `stopPropagation`s so tapping the star does not select the model. Filled/outline star reflects membership in `favoriteModels`.
- **Default tag** unchanged: `(default)` next to `defaultModelId`. Favorite and default are orthogonal — a model can be both.

## Consumer wiring

**None.** `settings-model-select.tsx`, `connect-card.tsx`, `generate-dialog.tsx`, and the four pages that render the dialog are untouched — `ModelSelect` handles favorites and sort entirely internally. This is the payoff of self-loading: every current and future model-select surface gets both features for free.

## Error handling

- `toggleFavoriteModel` returns `ActionResultT`; the consumer surfaces failures via `toastActionResult` and reverts the optimistic local state, exactly like the existing default-model save.
- Off-allowlist ids are rejected server-side (`isAllowedModel`), same guard as the default-model write.
- Not-connected case: the action's `maybeSingle` returns no row → `{ success: false, error: 'Connect OpenRouter first.' }`; the picker only renders when connected, so this is a latent guard (matches `set-model.ts`).

## Testing

- **Unit:** `sortModels` — name/input/output ordering + tie-break. Add the module to the `mutate` glob in `stryker.config.json` if not already covered.
- **E2E:** light/deferred per `context/foundation/test-plan.md` — the favorites toggle is a thin allowlisted write; not a high-risk surface warranting a dedicated browser spec for the MVP.
