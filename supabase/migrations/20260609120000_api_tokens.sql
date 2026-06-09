-- expose-cli-note-api (Phase 1): personal API tokens for the headless notes/cards HTTP API.
-- Only the SHA-256 hash of a token is stored. `resolve_api_token` is the SINGLE elevated surface:
-- SECURITY DEFINER, granted to anon (the request is unauthenticated when it runs). It returns a
-- user_id ONLY to a caller already holding the correct token (sha256 preimage is infeasible → the
-- hash is not enumerable) and bumps last_used_at. Every note/card WRITE then runs RLS-scoped under a
-- minted user JWT — no service-role anywhere; the ownership wall stays in the DB.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique,
  name text not null,
  scopes text[] not null default '{}', -- stored, NOT enforced in Phase 1
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.api_tokens enable row level security;

-- Owner-scoped management: mint via the user's own session (tests today, the Phase-2 settings UI
-- later), list, and revoke (= update revoked_at). No delete policy — revoke instead, to keep the row
-- as an audit trail. user_id defaults to auth.uid() and the with-check pins it, so a client cannot
-- mint a token for another user.
create policy api_tokens_select_own on public.api_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy api_tokens_insert_own on public.api_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy api_tokens_update_own on public.api_tokens
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The ONE elevated surface. SECURITY DEFINER bypasses RLS for this lookup only; `set search_path = ''`
-- closes the search-path hole (public.-qualified names; now()/pg_catalog are always implicitly in path).
-- Returns null when no live (not-revoked, not-expired) token matches the hash.
create function public.resolve_api_token(p_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  update public.api_tokens
     set last_used_at = now()
   where token_hash = p_hash
     and revoked_at is null
     and (expires_at is null or expires_at > now())
  returning user_id into v_user_id;
  return v_user_id;
end;
$$;

revoke execute on function public.resolve_api_token(text) from public;
grant execute on function public.resolve_api_token(text) to anon, authenticated;
