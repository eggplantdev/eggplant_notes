-- S-19 Phase 2: per-user OpenRouter BYOK credential, encrypted at rest (app-layer AES-256-GCM —
-- ciphertext/iv/auth-tag stored separately). The decrypted key NEVER touches the client; it is
-- decrypted server-side only when calling OpenRouter. RLS scopes the row to its owner; the FK cascade
-- to auth.users tears it down on account-delete (delete_account()'s cascade), so no extra teardown.
-- `model` holds the user's chosen model (null → app default).
create table openrouter_credentials (
  user_id        uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  key_ciphertext text not null,
  key_iv         text not null,
  key_auth_tag   text not null,
  model          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table openrouter_credentials enable row level security;

create policy "openrouter_credentials_select_own" on openrouter_credentials
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "openrouter_credentials_insert_own" on openrouter_credentials
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "openrouter_credentials_update_own" on openrouter_credentials
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "openrouter_credentials_delete_own" on openrouter_credentials
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at is DB-owned (moddatetime), same as the other tables — never hand-stamped in app code.
create trigger handle_updated_at before update on public.openrouter_credentials
  for each row execute function extensions.moddatetime(updated_at);
