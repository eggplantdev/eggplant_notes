-- S-06 organize-notes-into-subjects: add the subjects grouping layer.
-- A `subjects` parent table (mirrors the notes ownership/RLS pattern) plus a
-- nullable, user-ordered link from notes (`subject_id` + fractional `position`).
-- subjects is created BEFORE notes is altered, because the notes write policies
-- below reference subjects for the cross-user ownership check (F1 plan-review fix).
-- Additive only: existing notes get subject_id = null, position = null (valid
-- unassigned state). No data to preserve (PRD v2).

-- ============================================================================
-- subjects
-- A grouping above notes. A note may belong to one subject or to none.
-- ============================================================================
create table subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title       text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table subjects enable row level security;

create index subjects_user_id_idx on subjects using btree (user_id);

create policy "subjects_select_own" on subjects
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "subjects_insert_own" on subjects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "subjects_update_own" on subjects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "subjects_delete_own" on subjects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- notes: grouping link + ordering
-- subject_id detaches (set null) on subject delete so member notes survive.
-- position is fractional numeric: a drag-reorder writes one row's midpoint;
-- it is null exactly when subject_id is null.
-- ============================================================================
alter table notes add column subject_id uuid references subjects (id) on delete set null;
alter table notes add column position numeric;

create index notes_subject_id_position_idx on notes using btree (subject_id, position);

-- Extend the notes write policies so a note can only point at a subject the
-- caller owns (F1 plan-review fix). The FK guarantees the subject exists; this
-- guarantees it is the caller's. subjects' own SELECT RLS already scopes the
-- exists() to the user's rows; the explicit user_id check is defense-in-depth.
-- Cross-user subject assignment is rejected at the DB, not in app code.
drop policy "notes_insert_own" on notes;
create policy "notes_insert_own" on notes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      subject_id is null
      or exists (
        select 1 from subjects s
        where s.id = subject_id and s.user_id = (select auth.uid())
      )
    )
  );

drop policy "notes_update_own" on notes;
create policy "notes_update_own" on notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      subject_id is null
      or exists (
        select 1 from subjects s
        where s.id = subject_id and s.user_id = (select auth.uid())
      )
    )
  );
