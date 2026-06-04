-- daily-goal-progress-bar: per-user settings, starting with the daily review goal.
-- One row per user (user_id PK → auth.users), auto-created at signup by a trigger and
-- back-filled for existing accounts so every user has a row. Mirrors the subjects
-- ownership/RLS pattern. Teardown is via the auth.users FK cascade (delete_account()
-- already covers it) — no delete policy, no RPC change.

-- ============================================================================
-- user_settings
-- daily_goal: target distinct cards reviewed per day. Default 5 — MUST match the
-- TS DEFAULT_DAILY_GOAL constant (single source for the default, two places).
-- ============================================================================
create table user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  daily_goal  int not null default 5 check (daily_goal > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "user_settings_select_own" on user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_insert_own" on user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_settings_update_own" on user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================================
-- signup trigger: auto-create the settings row when a new auth user is inserted.
-- SECURITY DEFINER + empty search_path is the canonical Supabase pattern (the
-- trigger runs as the table owner, bypassing RLS, with no mutable search_path).
-- on conflict do nothing keeps it idempotent against the back-fill / replays.
-- ============================================================================
create function public.handle_new_user_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute function public.handle_new_user_settings();

-- Back-fill: every existing user gets a row (default daily_goal). Idempotent.
insert into public.user_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;
