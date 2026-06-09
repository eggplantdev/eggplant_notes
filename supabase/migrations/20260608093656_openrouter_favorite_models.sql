-- model-picker-sort-favorites: per-user curated favorite models for the OpenRouter picker.
-- Holds the model ids the user starred; surfaced as a "Favorites" group above "Recommended".
-- Shares the credential row's owner-scoped RLS + the auth.users FK cascade (no extra policy or
-- teardown). Empty default so existing rows backfill cleanly and reads never see null.
alter table openrouter_credentials
  add column favorite_models text[] not null default '{}';
