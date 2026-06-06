-- Mark sample/demo rows so the Load/Clear sample-data feature (S-12) can scope its deletes and
-- gate which control to show. The flag lives on all three content tables for a uniform marker;
-- gating reads are per-user + tiny, so no index. Additive only: existing rows default to false
-- (correct — user-authored content is never "seeded"), and the existing per-user RLS policies
-- already gate the whole row, so policies are unchanged.

alter table public.subjects add column is_seeded boolean not null default false;
alter table public.notes add column is_seeded boolean not null default false;
alter table public.memory_cards add column is_seeded boolean not null default false;
