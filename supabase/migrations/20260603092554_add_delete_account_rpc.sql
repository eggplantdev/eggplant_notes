-- S-05 delete-account-and-data: account self-deletion RPC.
-- A SECURITY DEFINER function lets an authenticated client delete ONLY its own
-- auth.users row without a service-role key. F-02's on-delete-cascade chain
-- (auth.users -> notes -> memory_cards -> review_events) tears down all owned data.
--
-- Safety rationale (do not weaken):
--   * SECURITY DEFINER runs privileged, so RLS does NOT protect this function.
--     The `where id = (select auth.uid())` predicate IS the entire security model
--     — it scopes the delete to the caller. Never widen it.
--   * `set search_path = ''` + fully-qualified names closes the search-path
--     privilege-escalation hole (Supabase's linter flags its absence).
--   * execute is revoked from public/anon and granted only to authenticated.
--
-- Hosted caveat: locally the migration runs as a superuser `postgres`, so the
-- function can delete from auth.users regardless of grants. On hosted Supabase
-- `postgres` is NOT a superuser and may lack that privilege — re-verify on first
-- hosted apply (fallback: own this function as supabase_auth_admin).

-- ============================================================================
-- public.delete_account()
-- ============================================================================
create function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
