-- Fix: inline checks-cards inherit the note's subject, upholding the invariant "a linked card shares
-- its note's subject". create_note_with_checks previously inserted the checks WITHOUT subject_id, so a
-- note created under a subject got linked-but-UNFILED cards — a state the UI never intends (it keeps a
-- linked card's subject in sync with its note). Both the web UI's create-note form and the token API's
-- POST /api/notes go through this RPC, so both produced the broken state. The attach path
-- (insertCardsForNote) already stamps the subject; this aligns creation with it. Setting the initial
-- subject at insert time is NOT a cross-entity cascade (the thing 20260606161054 avoided) — it's the
-- card taking the subject the caller chose for the note in the same call.
--
-- Unchanged otherwise: SECURITY INVOKER (RLS scopes every write to the owner), `set search_path = ''` +
-- public-qualified names, explicit column reads, the inline subject_title resolution arm, and grants.
create or replace function public.create_note_with_checks(p_note jsonb, p_checks jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_note_id uuid;
  v_subject_id uuid;
begin
  -- Reuse an existing subject by id, else create one from the given title. A reused id the caller does
  -- NOT own is rejected downstream by notes_insert_own's subject-ownership arm — same guard as import_notes.
  v_subject_id := nullif(p_note->>'subject_id', '')::uuid;
  if v_subject_id is null and nullif(p_note->>'subject_title', '') is not null then
    insert into public.subjects (title)
    values (p_note->>'subject_title')
    returning id into v_subject_id;
  end if;

  insert into public.notes (title, content, subject_id, position)
  values (
    p_note->>'title',
    coalesce(p_note->>'content', ''),
    v_subject_id,
    nullif(p_note->>'position', '')::numeric
  )
  returning id into v_note_id;

  -- Stamp the note's subject onto each checks-card so a linked card shares its note's subject.
  insert into public.memory_cards (note_id, subject_id, prompt, example, code_context)
  select
    v_note_id,
    v_subject_id,
    c->>'prompt',
    nullif(c->>'example', ''),
    nullif(c->>'code_context', '')
  from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) as c;

  return v_note_id;
end;
$$;

revoke execute on function public.create_note_with_checks(jsonb, jsonb) from public, anon;
grant execute on function public.create_note_with_checks(jsonb, jsonb) to authenticated;
