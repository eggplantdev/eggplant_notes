-- SMOKE TEST — exercises the pre-push prod-migrate guard end-to-end.
-- Safe + reversible: a locked-down throwaway table (RLS on, no policies = no
-- access, exposes nothing via the API). Remove with the companion revert
-- migration once the guard has been verified against prod.
create table if not exists public.migrate_smoke_test (
  id bigint generated always as identity primary key,
  noted_at timestamptz not null default now()
);
alter table public.migrate_smoke_test enable row level security;
