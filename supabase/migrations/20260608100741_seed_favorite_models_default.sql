-- model-picker-sort-favorites: the picker's top "Pinned" group is purely the user's curated set
-- (the hardcoded "Recommended" group was dropped). Seed a sensible starting set so a freshly
-- connected account isn't staring at an unsorted 300-model list.
--
-- These ids mirror RECOMMENDED_MODELS in src/features/openrouter/models.ts — keep the two aligned
-- (this default only affects NEW rows; changing the curated set later won't re-seed existing users).
-- Set as the column DEFAULT (applies on INSERT, including the OAuth-callback upsert which doesn't
-- name this column, and is left untouched on re-connect's conflict-update).
alter table openrouter_credentials
  alter column favorite_models set default array[
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-3.5-haiku',
    'anthropic/claude-3.7-sonnet',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct'
  ]::text[];

-- Backfill rows that still hold the old empty default. Safe: the favorites feature shipped in the
-- same change, so no user has intentionally cleared their pins yet.
update openrouter_credentials
  set favorite_models = array[
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-3.5-haiku',
    'anthropic/claude-3.7-sonnet',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.3-70b-instruct'
  ]::text[]
  where favorite_models = '{}';
