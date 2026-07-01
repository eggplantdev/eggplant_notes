-- Keep the new-account favorite_models default aligned with RECOMMENDED_MODELS in
-- src/features/openrouter/constants.ts: add GLM 5.2, swap Claude Sonnet 4.5 → Sonnet 5,
-- swap Claude 3.5 Haiku → Haiku 4.5.
-- Default only — affects NEW rows (incl. the OAuth-callback upsert). No backfill: existing users
-- may have curated their pins, so we don't overwrite them.
alter table openrouter_credentials
  alter column favorite_models set default array[
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-haiku-4.5',
    'anthropic/claude-sonnet-5',
    'z-ai/glm-5.2',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct'
  ]::text[];
