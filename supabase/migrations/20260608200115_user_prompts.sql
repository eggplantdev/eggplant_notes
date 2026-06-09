-- editable-system-prompts: per-user overrides of the AI system prompts. One row per
-- (user, prompt_key); a row's ABSENCE means "use the built-in constant" (see prompts.ts
-- BUILTIN_SYSTEM). Mirrors the user_settings ownership/RLS pattern, but ADDS a delete
-- policy — the dialog's "Reset prompt" deletes the row to fall back to the default.
-- No signup trigger / back-fill: zero rows is the correct default state (built-in prompts).

-- ============================================================================
-- user_prompts
-- prompt_key: which system prompt this overrides. Constrained to the three keys the
-- app resolves (cards, notes_decompose, notes_topic) — must match PromptKeyT in prompts.ts.
-- system: the user's replacement system-prompt text.
-- ============================================================================
create table user_prompts (
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  prompt_key  text not null check (prompt_key in ('cards', 'notes_decompose', 'notes_topic')),
  system      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, prompt_key)
);

alter table user_prompts enable row level security;

create policy "user_prompts_select_own" on user_prompts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_prompts_insert_own" on user_prompts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_prompts_update_own" on user_prompts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Reset deletes the row to restore the built-in default — unlike user_settings, this table
-- needs a delete policy.
create policy "user_prompts_delete_own" on user_prompts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at is DB-owned (moddatetime), per the project rule — never hand-stamped in app code.
-- The Save upsert's ON CONFLICT DO UPDATE fires this BEFORE UPDATE trigger; INSERT uses the default.
create trigger handle_updated_at before update on public.user_prompts
  for each row execute function extensions.moddatetime(updated_at);
