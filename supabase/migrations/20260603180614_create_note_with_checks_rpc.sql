-- S-07 create-note-with-checks: atomic create of a note + N memory cards.
-- memory_cards.note_id is NOT NULL FK, so a check cannot exist before its note.
-- This RPC inserts the note, captures its id, inserts each staged check against
-- that id, and returns the new note id — all in one transaction (all-or-nothing).
--
-- SECURITY INVOKER (default): runs as the calling user, so RLS scopes every write
-- to the owner — no privilege escalation (unlike S-05's definer delete_account).
-- Mirrors S-03's record_review atomic-writer pattern. `set search_path = ''` +
-- public.-qualified names closes the search-path hole.
--
-- Mass-assignment guard: note columns are read EXPLICITLY from p_note (title,
-- content, subject_id, position) — never jsonb_populate_record — so a caller
-- cannot smuggle in user_id and defeat the `default auth.uid()` + RLS guard.
-- user_id is left to its column default; the notes_insert_own / memory_cards_insert_own
-- `with check` policies (incl. S-06's owned-subject check) apply to these inserts.
create function public.create_note_with_checks(p_note jsonb, p_checks jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_note_id uuid;
begin
  insert into public.notes (title, content, subject_id, position)
  values (
    p_note->>'title',
    coalesce(p_note->>'content', ''),
    nullif(p_note->>'subject_id', '')::uuid,
    nullif(p_note->>'position', '')::numeric
  )
  returning id into v_note_id;

  insert into public.memory_cards (note_id, prompt, example, code_context)
  select
    v_note_id,
    c->>'prompt',
    nullif(c->>'example', ''),
    nullif(c->>'code_context', '')
  from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) as c;

  return v_note_id;
end;
$$;

revoke execute on function public.create_note_with_checks(jsonb, jsonb) from public, anon;
grant execute on function public.create_note_with_checks(jsonb, jsonb) to authenticated;
