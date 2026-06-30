-- merge-card-example-and-code-context: collapse memory_cards.code_context into example so a card has
-- ONE markdown answer field instead of two. The split was authoring-only (both columns rendered
-- identically, stacked); the new UX is a single field that starts as a textarea and upgrades to the
-- markdown editor on demand. See context/changes/merge-card-example-and-code-context/change.md.
--
-- Order matters: FOLD first (preserve every card's code) THEN drop the column. Idempotent — re-running
-- after the column is gone is a no-op (the UPDATE/DROP both guard on existence). Prod is migrated by
-- hand with this same file (agent never pushes the prod DB), so the fold-before-drop sequence is what
-- protects the 52 prod cards that carry code_context.

-- Fold: case-B (both set) → "example\n\ncode_context" (the \n\n reproduces the current rendered block
-- break between the two stacked RenderMarkdown blocks); case-A (code only) → example := code_context.
-- A blank/whitespace-only code_context contributes nothing (left as-is). Guarded on the column still
-- existing so a re-run after the drop is a no-op (idempotent).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'memory_cards' and column_name = 'code_context'
  ) then
    update public.memory_cards
    set example = case
      when example is null or btrim(example) = '' then code_context
      else example || E'\n\n' || code_context
    end
    where code_context is not null and btrim(code_context) <> '';
  end if;
end $$;

alter table public.memory_cards drop column if exists code_context;

-- The create_note_with_cards RPC inserted into code_context; drop that arm so it matches the new
-- shape. Body otherwise identical to 20260626154723 (SECURITY INVOKER, empty search_path,
-- public-qualified names, subject_title resolution, subject-stamp per card, grants).
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

  insert into public.memory_cards (note_id, subject_id, prompt, example)
  select
    v_note_id,
    v_subject_id,
    c->>'prompt',
    nullif(c->>'example', '')
  from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) as c;

  return v_note_id;
end;
$$;

revoke execute on function public.create_note_with_cards(jsonb, jsonb) from public, anon;
grant execute on function public.create_note_with_cards(jsonb, jsonb) to authenticated;
