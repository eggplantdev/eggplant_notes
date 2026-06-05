-- F-02 persistence-and-isolation: first migration.
-- Three core domain tables with Row-Level Security scoping every row to its
-- owner via (select auth.uid()). Cascade chain: notes -> memory_cards -> review_events.
-- Mutations, SM-2 write logic, and UI are out of scope (deferred to slices S-01/S-03/S-05).

-- ============================================================================
-- notes
-- ============================================================================
create table notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title      text,
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes enable row level security;

create index notes_user_id_idx on notes using btree (user_id);

create policy "notes_select_own" on notes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "notes_insert_own" on notes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "notes_update_own" on notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notes_delete_own" on notes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- memory_cards
-- SM-2 scheduling columns (ease_factor / interval_days / repetitions / due_at)
-- are present but UNWRITTEN until S-03 owns the review write path. They default
-- to a fresh-card state so the S-03 "what's due now" query (user_id, due_at) is
-- indexed from day one without a later ALTER.
-- ============================================================================
create table memory_cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  note_id       uuid not null references notes (id) on delete cascade,
  prompt        text not null,
  ease_factor   real not null default 2.5,
  interval_days integer not null default 0,
  repetitions   integer not null default 0,
  due_at        timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table memory_cards enable row level security;

create index memory_cards_user_id_idx on memory_cards using btree (user_id);
create index memory_cards_note_id_idx on memory_cards using btree (note_id);
create index memory_cards_user_id_due_at_idx on memory_cards using btree (user_id, due_at);

create policy "memory_cards_select_own" on memory_cards
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "memory_cards_insert_own" on memory_cards
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "memory_cards_update_own" on memory_cards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "memory_cards_delete_own" on memory_cards
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- review_events
-- Append-only log of reviews. rating is the SM-2 0-5 quality grade (locked).
-- ============================================================================
create table review_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  memory_card_id uuid not null references memory_cards (id) on delete cascade,
  rating         smallint not null check (rating between 0 and 5),
  reviewed_at    timestamptz not null default now()
);

alter table review_events enable row level security;

create index review_events_user_id_idx on review_events using btree (user_id);
create index review_events_memory_card_id_idx on review_events using btree (memory_card_id);

create policy "review_events_select_own" on review_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "review_events_insert_own" on review_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "review_events_update_own" on review_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "review_events_delete_own" on review_events
  for delete to authenticated
  using ((select auth.uid()) = user_id);
