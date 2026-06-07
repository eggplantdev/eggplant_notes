-- Dashboard / memory-cards stats aggregation, pushed into SQL.
--
-- Before this, three reads fetched whole owned tables and aggregated in TypeScript
-- (getReviewActivity / getCardsForStats / getNotesForStats) — over-fetching that grew with
-- review-event volume, plus an arbitrary ~400-day window on the activity read. These functions do
-- the GROUP BY / counts in Postgres, so a multi-year history collapses to ~one row per calendar day
-- and the window disappears entirely.
--
-- SECURITY INVOKER (default) on every function: they run as the calling user, so the existing RLS
-- policies on memory_cards / review_events / notes scope every count to the owner — a SECURITY
-- DEFINER here would be a cross-user leak. `set search_path = ''` + public-qualified names closes
-- the search-path hole, matching record_review / create_note_with_checks.
--
-- The app's calendar zone (Europe/Warsaw) is passed in as p_time_zone rather than hardcoded, so the
-- TS APP_TIME_ZONE constant stays the single source of truth and a future per-user zone is a
-- one-arg change, not a migration. Named zone (not a fixed +01:00) so Postgres applies DST.

-- Distinct cards + total events per LOCAL calendar day. p_since null = all history (dashboard
-- streak/heatmap, naturally small: bounded by days, not events); a bounded p_since keeps the hot
-- rateMemoryCard path (today + trailing week only) from scanning the full history on every rating.
create function public.review_day_counts(p_time_zone text, p_since timestamptz default null)
returns table (day date, distinct_cards integer, total_events integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (reviewed_at at time zone p_time_zone)::date as day,
    count(distinct memory_card_id)::integer as distinct_cards,
    count(*)::integer as total_events
  from public.review_events
  where p_since is null or reviewed_at >= p_since
  group by 1
  order by 1;
$$;

grant execute on function public.review_day_counts(text, timestamptz) to authenticated;

-- Dashboard stat tiles + "needs attention" list, one round-trip.
--   overdue          — cards whose due date is before today's LOCAL calendar date
--   dueNow           — cards due as of now() (same rule as getDueQueue)
--   reviewsInWindow  — review events in the trailing p_window_days (rolling, matches old getRecentRatings)
--   good             — of those, rated >= 3 (retention numerator; TS divides, guarding /0)
--   hardest          — top 5 lapsing cards (most lapses, ties broken by lower stability) + note title
create function public.card_stats(p_time_zone text, p_window_days integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
    today_start as (
      select date_trunc('day', now() at time zone p_time_zone) at time zone p_time_zone as ts
    ),
    -- One scan of the trailing window yields both the total and the good (>=3) count.
    window_reviews as (
      select
        count(*)::integer as total,
        count(*) filter (where rating >= 3)::integer as good
      from public.review_events
      where reviewed_at >= now() - make_interval(days => p_window_days)
    ),
    hardest as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'prompt', c.prompt,
            'noteId', c.note_id,
            'noteTitle', coalesce(n.title, 'Untitled'),
            'lapses', c.lapses,
            'stability', c.stability
          )
          order by c.lapses desc, c.stability asc
        ),
        '[]'::jsonb
      ) as arr
      from (
        select id, prompt, note_id, lapses, stability
        from public.memory_cards
        where lapses > 0
        order by lapses desc, stability asc
        limit 5
      ) c
      left join public.notes n on n.id = c.note_id
    )
  select jsonb_build_object(
    'overdue', (select count(*) from public.memory_cards where due_at < (select ts from today_start)),
    'dueNow', (select count(*) from public.memory_cards where due_at <= now()),
    'reviewsInWindow', (select total from window_reviews),
    'good', (select good from window_reviews),
    'hardest', (select arr from hardest)
  );
$$;

grant execute on function public.card_stats(text, integer) to authenticated;

-- Whole-deck overview for the /memory-cards "Cards overview" chart: count per FSRS state and the
-- mature split. p_mature_stability is the TS MATURE_STABILITY_DAYS threshold, passed in so the
-- vocabulary stays single-sourced in app code. byState is a {state: count} object (absent states
-- omitted — the chart zero-fills).
create function public.card_overview(p_mature_stability numeric)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'byState', (
      select coalesce(jsonb_object_agg(state, cnt), '{}'::jsonb)
      from (select state, count(*) as cnt from public.memory_cards group by state) s
    ),
    'mature', (select count(*) from public.memory_cards where stability >= p_mature_stability),
    'total', (select count(*) from public.memory_cards)
  );
$$;

grant execute on function public.card_overview(numeric) to authenticated;
