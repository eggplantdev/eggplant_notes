-- Auto-bump updated_at on every UPDATE via the moddatetime extension, replacing the
-- per-action `updated_at: new Date().toISOString()` stamps in the app (notes, subjects,
-- memory_cards, user_settings). The columns already default now() on INSERT; this closes
-- the UPDATE gap so the DB clock owns "last modified" — one clock, never forgotten by a
-- new mutation. review_events is append-only (no updated_at), so it's excluded.

-- moddatetime ships with Supabase; install into the conventional `extensions` schema.
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on public.notes
  for each row execute function extensions.moddatetime(updated_at);

create trigger handle_updated_at before update on public.subjects
  for each row execute function extensions.moddatetime(updated_at);

create trigger handle_updated_at before update on public.memory_cards
  for each row execute function extensions.moddatetime(updated_at);

create trigger handle_updated_at before update on public.user_settings
  for each row execute function extensions.moddatetime(updated_at);
