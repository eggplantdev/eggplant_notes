-- standalone-memory-cards: decouple memory_cards from notes.
-- A card can now exist without a source note, and owns its own subject (the
-- single read source for the /memory-cards list filter). No triggers — the app
-- owns every write to subject_id; the only cross-entity move (note-subject ->
-- linked cards) is an explicit, user-confirmed bulk update, not a cascade.
-- Additive/relaxing only: existing rows keep note_id; subject_id defaults null.

-- note_id becomes optional: a standalone card has no source note.
alter table memory_cards alter column note_id drop not null;

-- A card's own subject. Detaches (set null) on subject delete so the card
-- survives. The list subject-filter keys off this column, not the note's.
alter table memory_cards add column subject_id uuid references subjects (id) on delete set null;

create index memory_cards_subject_id_idx on memory_cards using btree (subject_id);

-- Extend the write policies so a card can only point at a subject the caller
-- owns, mirroring the notes policies (20260603151508). The FK guarantees the
-- subject exists; this guarantees it is the caller's. Cross-user subject
-- assignment is rejected at the DB, not in app code.
drop policy "memory_cards_insert_own" on memory_cards;
create policy "memory_cards_insert_own" on memory_cards
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

drop policy "memory_cards_update_own" on memory_cards;
create policy "memory_cards_update_own" on memory_cards
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
