-- note-create-subject-select: let the create-note form create a NEW subject inline. Adds a subject-
-- resolution arm to create_note_with_checks, mirroring import_notes: when no subject_id is given but a
-- subject_title is, insert the subject and use its id — all in the one transaction (atomic, so a failed
-- note insert rolls back the new subject too).
--
-- Unchanged otherwise: SECURITY INVOKER (RLS scopes every write to the owner — the new subjects insert is
-- guarded by the subjects_insert_own policy), `set search_path = ''` + public-qualified names, explicit
-- column reads (no jsonb_populate_record / user_id smuggling), and the grants.
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
