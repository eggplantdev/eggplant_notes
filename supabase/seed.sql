-- supabase/seed.sql
-- Runs automatically after migrations on `supabase db reset` (config.toml -> [db.seed]).
-- Purpose: a deterministic DEV playground — one known, log-in-able account whose
-- topic_checks span the FSRS state/due spectrum, so the /review loop and the dashboard
-- can be exercised by hand without clicking through sign-up + note + card creation.
--
-- This is DEV-ONLY. It is never run on Vercel (preview/prod never call `db reset`); it
-- only ever touches your LOCAL Postgres. E2E specs do NOT depend on it — they self-seed
-- via the UI — so the two data lanes stay orthogonal.
--
-- Log in as either:
--   dev@example.com   / password123   -- minimal FSRS smoke-test bed (sections 1-4)
--   test@gmail.com    / test@Test      -- rich playground: 24 subjects, 60 notes,
--                                         cards + pending reviews (sections 5-9)
--
-- The test@gmail.com data is generated with deterministic UUIDs + `on conflict do
-- nothing`, so re-running this file is idempotent (unlike the dev topic_checks block).

-- ----------------------------------------------------------------------------
-- 1. A confirmed auth user. GoTrue needs BOTH auth.users and a matching
--    auth.identities row, a bcrypt password (pgcrypto's crypt/gen_salt), and
--    empty-string (not NULL) token columns — NULLs break some GoTrue queries.
--    Fixed UUID so every reset reproduces the same owner id.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'authenticated', 'authenticated',
  'dev@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
)
values (
  gen_random_uuid(),
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","email":"dev@example.com"}',
  'email',
  now(), now(), now()
)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 2. One subject note to hang cards off of. user_id is set explicitly: seed runs
--    as postgres (RLS-bypassing, auth.uid() is NULL here), so the column default
--    `auth.uid()` would insert NULL and violate NOT NULL.
-- ----------------------------------------------------------------------------
insert into notes (id, user_id, title, content)
values (
  '11111111-1111-1111-1111-111111111111',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'FSRS smoke-test note',
  e'# Spaced repetition test bed\n\nCards below span every FSRS state and due window.'
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. topic_checks across the FSRS spectrum. state: 0=New 1=Learning 2=Review 3=Relearning.
--    The /review "due" query is `due_at <= now()`, so anything past/now appears in a
--    session and anything future is hidden — giving you a visible due-count and a
--    "come back later" empty state to verify in one seed.
-- ----------------------------------------------------------------------------
insert into topic_checks (
  user_id, note_id, prompt, example, code_context,
  state, stability, difficulty, elapsed_days, scheduled_days,
  learning_steps, reps, lapses, due_at, last_review
)
values
  -- New card, never reviewed, due now. Exercises the createEmptyCard path + first grade.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   'What does `state = 0` mean in FSRS?', 'A brand-new card.', null,
   0, 0, 0, 0, 0, 0, 0, 0, now(), null),

  -- Learning card, due now.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   'Recall the FSRS learning steps.', null, null,
   1, 1.2, 5.0, 0, 0, 1, 1, 0, now() - interval '10 minutes', now() - interval '10 minutes'),

  -- OVERDUE review card (due 3 days ago). Should headline the due list.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   'Explain stability vs. difficulty in FSRS.',
   'stability = days until R drops to 90%; difficulty = intrinsic hardness.', null,
   2, 8.0, 5.5, 7, 4, 0, 3, 0, now() - interval '3 days', now() - interval '7 days'),

  -- Review card due right now (boundary case for `<= now()`).
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   'What does `record_review` persist atomically?', null,
   e'```sql\nupdate topic_checks ... ; insert into review_events ...\n```',
   2, 4.0, 6.0, 2, 2, 0, 2, 1, now(), now() - interval '2 days'),

  -- FUTURE review card (due in 5 days) — NOT due, must be hidden from /review.
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111',
   'Why is this card not in today''s session?', 'Because due_at > now().', null,
   2, 12.0, 4.0, 1, 5, 0, 4, 0, now() + interval '5 days', now() - interval '1 day');

-- ----------------------------------------------------------------------------
-- 4. A handful of past review_events so the dashboard heatmap/stats render with
--    real history instead of an empty grid. rating is FSRS 1..4 (Again..Easy).
-- ----------------------------------------------------------------------------
insert into review_events (user_id, topic_check_id, rating, reviewed_at)
select
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  tc.id,
  1 + (floor(random() * 4))::smallint,            -- 1..4
  now() - (g.d || ' days')::interval
from topic_checks tc
cross join generate_series(0, 6) as g(d)
where tc.user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  and tc.note_id = '11111111-1111-1111-1111-111111111111'
limit 20;

-- ============================================================================
-- 5. test@gmail.com — the rich playground account. Same confirmed-user ritual
--    as section 1 (auth.users + auth.identities, bcrypt password, empty-string
--    token columns). Fixed UUID so resets reproduce the same owner id.
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'authenticated', 'authenticated',
  'test@gmail.com',
  crypt('test@Test', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
)
values (
  gen_random_uuid(),
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","email":"test@gmail.com"}',
  'email',
  now(), now(), now()
)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 6. 24 subjects (>= the requested 20). Deterministic id = 5b1ec700…<idx>.
--    user_id set explicitly (seed runs as postgres; auth.uid() is NULL here).
-- ----------------------------------------------------------------------------
insert into subjects (id, user_id, title, description)
select
  ('5b1ec700-0000-0000-0000-' || lpad(s.idx::text, 12, '0'))::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  s.title,
  s.title || ' — study subject.'
from (values
  (1, 'TypeScript'), (2, 'JavaScript'), (3, 'React'), (4, 'Next.js'),
  (5, 'Node.js'), (6, 'Python'), (7, 'SQL & Databases'), (8, 'PostgreSQL'),
  (9, 'Supabase'), (10, 'Tailwind CSS'), (11, 'CSS'), (12, 'HTML'),
  (13, 'Git & GitHub'), (14, 'Docker'), (15, 'Linux & Shell'), (16, 'Testing'),
  (17, 'System Design'), (18, 'Algorithms'), (19, 'Data Structures'), (20, 'REST & APIs'),
  (21, 'Authentication'), (22, 'Performance'), (23, 'Functional Programming'), (24, 'DevOps')
) as s(idx, title)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. 60 notes. Notes 1-50 are assigned to a subject round-robin (subject_id +
--    fractional position); notes 51-60 stay unassigned (subject_id/position NULL)
--    so the "some notes don't attach to a subject" case is exercised.
--    Deterministic id = 0a7e0000…<n> so topic_checks below can reference them.
-- ----------------------------------------------------------------------------
insert into notes (id, user_id, title, content, subject_id, position)
select
  ('0a7e0000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'Study note ' || n,
  e'# Study note ' || n || e'\n\nNotes and takeaways for item ' || n
    || e'.\n\n```ts\nconst value = ' || n || e';\nexport function double(x: number) {\n  return x * 2;\n}\n```',
  case when n <= 50
    then ('5b1ec700-0000-0000-0000-' || lpad((((n - 1) % 24) + 1)::text, 12, '0'))::uuid
    else null end,
  case when n <= 50 then n::numeric else null end
from generate_series(1, 60) as n
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 8. topic_checks on notes 1-30 (1-2 cards each). Cards on notes 1-20 are due in
--    the PAST (state=2 Review) -> they populate the /review session as pending;
--    cards on notes 21-30 are New and due in the FUTURE (hidden from /review).
--    Deterministic id = c4ec0000…<n*10+c>.
-- ----------------------------------------------------------------------------
insert into topic_checks (
  id, user_id, note_id, prompt, example, code_context,
  state, stability, difficulty, elapsed_days, scheduled_days,
  learning_steps, reps, lapses, due_at, last_review
)
select
  ('c4ec0000-0000-0000-0000-' || lpad((n * 10 + c)::text, 12, '0'))::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  ('0a7e0000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'Recall point ' || c || ' from study note ' || n || '?',
  case when c = 1 then 'A worked example for note ' || n || '.' else null end,
  null,
  case when n <= 20 then 2 else 0 end,                                   -- state: Review vs New
  case when n <= 20 then 5.0 else 0 end,                                 -- stability
  case when n <= 20 then 5.0 else 0 end,                                 -- difficulty
  0,
  case when n <= 20 then 4 else 0 end,                                   -- scheduled_days
  0,
  case when n <= 20 then 3 else 0 end,                                   -- reps
  0,
  case when n <= 20
    then now() - (n || ' hours')::interval                               -- DUE now/past -> pending
    else now() + (n || ' days')::interval end,                           -- future -> hidden
  case when n <= 20 then now() - interval '3 days' else null end
from generate_series(1, 30) as n
cross join generate_series(1, 1 + (n % 2)) as c
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 9. review_events history for the first 10 due cards, one per day over the last
--    14 days, so the dashboard heatmap/stats render with real history. rating is
--    FSRS 1..4 (Again..Easy), computed (not random) to stay idempotent.
-- ----------------------------------------------------------------------------
insert into review_events (id, user_id, topic_check_id, rating, reviewed_at)
select
  ('5e1e0000-0000-0000-0000-' || lpad((tc.rn * 100 + g.d)::text, 12, '0'))::uuid,
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  tc.id,
  (1 + (g.d % 4))::smallint,                                             -- 1..4
  now() - (g.d || ' days')::interval
from (
  select id, row_number() over (order by id) as rn
  from topic_checks
  where user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' and state = 2
) as tc
cross join generate_series(0, 13) as g(d)
where tc.rn <= 10
on conflict (id) do nothing;
