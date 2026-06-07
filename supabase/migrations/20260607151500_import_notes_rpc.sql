-- S-19 import-markdown-to-notes (Phase 1): atomic bulk import of N notes under a subject (existing
-- or newly created). The deterministic markdown heading-split + preview happen client-side; this RPC
-- only commits the (possibly edited) result.
--
-- Mirrors create_note_with_checks: SECURITY INVOKER so RLS scopes every write to the owner (no
-- privilege escalation), `set search_path = ''` + public.-qualified names close the search-path hole,
-- and note columns are read EXPLICITLY from the jsonb (no jsonb_populate_record) so a caller cannot
-- smuggle in user_id and defeat the `default auth.uid()` + RLS guard.
create function public.import_notes(p_subject jsonb, p_notes jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject_id uuid;
  v_base numeric;
begin
  -- Reuse an existing subject by id, else create one from the given title. A reused id the caller
  -- does NOT own is rejected downstream by the notes_insert_own `with check` (subject-ownership arm) —
  -- cross-user assignment is blocked at the DB, not in app code.
  v_subject_id := nullif(p_subject->>'id', '')::uuid;
  if v_subject_id is null then
    insert into public.subjects (title)
    values (p_subject->>'title')
    returning id into v_subject_id;
  end if;

  -- Append after the subject's current notes without a max(position) read (same approach as
  -- createNote's Date.now()): a millisecond epoch base + per-row ordinality keeps the imported set
  -- ordered among itself and after prior imports.
  v_base := extract(epoch from clock_timestamp()) * 1000;

  insert into public.notes (title, content, subject_id, position)
  select
    n.value->>'title',
    coalesce(n.value->>'content', ''),
    v_subject_id,
    v_base + n.ordinality
  from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb)) with ordinality as n(value, ordinality);

  return v_subject_id;
end;
$$;

revoke execute on function public.import_notes(jsonb, jsonb) from public, anon;
grant execute on function public.import_notes(jsonb, jsonb) to authenticated;
