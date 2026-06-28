-- Rename the create-note-with-its-cards RPC to match the app/wire vocabulary. The legacy name
-- `create_note_with_checks(p_note, p_checks)` was kept after the app + HTTP-API field was renamed
-- `checks` → `cards` (to avoid a migration); this brings the DB in sync so the whole path speaks
-- `cards`. Safe to break the old signature: there are no API consumers pinned to it, and the app
-- (insert-note-with-cards.ts + the direct-RPC test) is updated to the new name in the same change.
--
-- Body is identical to 20260609140000 (SECURITY INVOKER, `set search_path = ''`, public-qualified
-- names, subject_title resolution arm, subject-stamp on each card, grants) — only the function name
-- and the `p_checks` → `p_cards` param are renamed.
create or replace function public.create_note_with_cards(p_note jsonb, p_cards jsonb)
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

  -- Stamp the note's subject onto each card so a linked card shares its note's subject.
  insert into public.memory_cards (note_id, subject_id, prompt, example, code_context)
  select
    v_note_id,
    v_subject_id,
    c->>'prompt',
    nullif(c->>'example', ''),
    nullif(c->>'code_context', '')
  from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) as c;

  return v_note_id;
end;
$$;

revoke execute on function public.create_note_with_cards(jsonb, jsonb) from public, anon;
grant execute on function public.create_note_with_cards(jsonb, jsonb) to authenticated;

-- Retire the legacy signature. No remaining caller after this change.
drop function if exists public.create_note_with_checks(jsonb, jsonb);
