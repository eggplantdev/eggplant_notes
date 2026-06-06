-- Drop the redundant `updated_at = now()` from record_review: the moddatetime trigger
-- (20260606083954_auto_bump_updated_at.sql) now bumps memory_cards.updated_at on every
-- UPDATE, including this one, so the explicit set is dead weight. CREATE OR REPLACE keeps
-- the existing grants/ownership; the signature is unchanged. Behaviour is identical —
-- updated_at still moves to now() on a review, now via the trigger as the sole writer.

create or replace function public.record_review(
  p_memory_card_id uuid,
  p_rating smallint,
  p_card jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.memory_cards set
    stability      = (p_card->>'stability')::real,
    difficulty     = (p_card->>'difficulty')::real,
    elapsed_days   = (p_card->>'elapsed_days')::integer,
    scheduled_days = (p_card->>'scheduled_days')::integer,
    learning_steps = (p_card->>'learning_steps')::integer,
    reps           = (p_card->>'reps')::integer,
    lapses         = (p_card->>'lapses')::integer,
    state          = (p_card->>'state')::smallint,
    due_at         = (p_card->>'due')::timestamptz,
    last_review    = (p_card->>'last_review')::timestamptz
  where id = p_memory_card_id;

  if not found then
    raise exception 'memory card not found or not owned';
  end if;

  insert into public.review_events (memory_card_id, rating)
  values (p_memory_card_id, p_rating);
end;
$$;
