-- S-03 close-recall-loop: migrate topic_checks scheduling state SM-2 -> FSRS.
-- S-03 is the FIRST writer of scheduling state, so there is no production data to
-- backfill: drop the SM-2 columns, add FSRS state columns with empty-card defaults
-- (existing local rows become valid fresh "New" cards), retune the rating grade
-- range 0-5 -> 1-4 (FSRS Rating.Again..Easy), and add the atomic record_review RPC.

-- ============================================================================
-- topic_checks: SM-2 columns -> FSRS state
-- FSRS Card fields persisted as columns; due_at doubles as FSRS `due`. Defaults
-- mirror ts-fsrs createEmptyCard() (state=0/New, all counters 0) so any pre-existing
-- row is a valid New card without a backfill.
-- ============================================================================
alter table topic_checks drop column ease_factor;
alter table topic_checks drop column interval_days;
alter table topic_checks drop column repetitions;

alter table topic_checks add column stability real not null default 0;
alter table topic_checks add column difficulty real not null default 0;
alter table topic_checks add column elapsed_days integer not null default 0;
alter table topic_checks add column scheduled_days integer not null default 0;
alter table topic_checks add column learning_steps integer not null default 0;
alter table topic_checks add column reps integer not null default 0;
alter table topic_checks add column lapses integer not null default 0;
alter table topic_checks add column state smallint not null default 0;
alter table topic_checks add column last_review timestamptz;

-- ============================================================================
-- review_events: retune the grade range to FSRS Rating (Again=1..Easy=4)
-- ============================================================================
alter table review_events drop constraint review_events_rating_check;
alter table review_events add constraint review_events_rating_check check (rating between 1 and 4);

-- ============================================================================
-- public.record_review(p_topic_check_id, p_rating, p_card)
-- Atomic writer for one review: ts-fsrs computes the next Card in TypeScript and
-- passes the already-computed fields here as jsonb; this function only persists
-- them (update topic_checks + insert review_events) in one transaction.
--
-- SECURITY INVOKER (default): runs as the calling user, so RLS scopes both writes
-- to the owner — no privilege escalation (unlike S-05's definer delete_account).
-- `set search_path = ''` + public.-qualified names closes the search-path hole.
--
-- Order matters (self-defending ownership guard): UPDATE first; RLS makes a foreign
-- or forged id match 0 rows, the `if not found` raise then aborts the whole
-- transaction BEFORE any review_event is written. The RPC thus enforces the
-- card<->caller link itself, not merely trusting the Server Action's prior re-fetch.
-- ============================================================================
create function public.record_review(
  p_topic_check_id uuid,
  p_rating smallint,
  p_card jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.topic_checks set
    stability      = (p_card->>'stability')::real,
    difficulty     = (p_card->>'difficulty')::real,
    elapsed_days   = (p_card->>'elapsed_days')::integer,
    scheduled_days = (p_card->>'scheduled_days')::integer,
    learning_steps = (p_card->>'learning_steps')::integer,
    reps           = (p_card->>'reps')::integer,
    lapses         = (p_card->>'lapses')::integer,
    state          = (p_card->>'state')::smallint,
    due_at         = (p_card->>'due')::timestamptz,
    last_review    = (p_card->>'last_review')::timestamptz,
    updated_at     = now()
  where id = p_topic_check_id;

  if not found then
    raise exception 'topic check not found or not owned';
  end if;

  insert into public.review_events (topic_check_id, rating)
  values (p_topic_check_id, p_rating);
end;
$$;

revoke execute on function public.record_review(uuid, smallint, jsonb) from public, anon;
grant execute on function public.record_review(uuid, smallint, jsonb) to authenticated;
