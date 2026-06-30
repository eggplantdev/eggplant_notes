#!/usr/bin/env node
// DEV-ONLY seed generator. NOT part of any build; never runs on CI/Vercel.
//
// Turns a real learning-notes markdown file + its parallel Anki-flashcard file
// (the operator's `/workspace/learning` corpus) into a deterministic seed block
// for supabase/seed.sql:
//
//   subject  ->  one note per top-level (#) section of the notes file
//            ->  memory_cards from the flashcards (Q -> prompt, A -> example),
//                each attached to the note section it best matches.
//
// The two source files are independent real artifacts: the notes file holds the
// prose/code explanation (note.content), the flashcards hold the recall Q/A
// (card.prompt / card.example). No duplication, no schema change.
//
// Usage (from repo root):
//   node supabase/seed-scripts/generate-section-seed.mjs [notesFile] [cardsFile] > /tmp/seed-block.sql
//
// Defaults point at the Python-functional section. Paths are resolved relative
// to the repo root so the personal `/workspace/learning` home path is not baked
// into this public repo.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const learningRoot = resolve(repoRoot, '..', 'learning'); // /workspace/learning

const notesFile =
  process.argv[2] ??
  resolve(learningRoot, 'python/functional_p/functional_programming_py_notes.md');
const cardsFile =
  process.argv[3] ??
  resolve(learningRoot, 'flashcards/python_functional/functional_programming_flashcards.md');

// Owner + deterministic id prefixes (mirror the conventions already in seed.sql).
const USER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'; // test@gmail.com
const SUBJECT_ID = '5b1ec700-0000-4000-8000-000000000001';
const SUBJECT_TITLE = 'Python — Functional Programming';
const SUBJECT_DESC = 'Functional programming in Python: pure functions, higher-order functions, closures, currying, decorators, recursion. Seeded from real learning notes.';

const FENCE = /^\s*```/;

// ---------------------------------------------------------------------------
// 1. Split the notes file into sections on top-level `#` headings, ignoring
//    any `#` that appears inside a fenced code block (e.g. `# comment` in ```py).
// ---------------------------------------------------------------------------
function parseNoteSections(md) {
  const lines = md.split('\n');
  const sections = [];
  let inFence = false;
  let current = null;
  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    const isH1 = !inFence && /^#\s+\S/.test(line);
    if (isH1) {
      if (current) sections.push(current);
      // Heading drives the note `title`, which the note view renders as a separate element — so it is
      // NOT kept in `body` (matches splitMarkdown's import convention). Keeping it duplicated the title
      // in the note view and in AI card-generation material (cardsMaterialFromNote prepends it again).
      current = { title: line.replace(/^#\s+/, '').trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
    // lines before the first heading are dropped (none expected)
  }
  if (current) sections.push(current);
  return sections
    .map((s) => ({ title: s.title, content: s.body.join('\n').trim() }))
    .filter((s) => s.title.length > 0);
}

// ---------------------------------------------------------------------------
// 2. Parse flashcards: `##` groups, each holding Q:/A: pairs (A may be
//    multiline incl. code fences). Fence-aware so a stray `Q:`/`A:`/`##`
//    inside code is not mistaken for structure.
// ---------------------------------------------------------------------------
function parseCards(md) {
  const lines = md.split('\n');
  const groups = [];
  let inFence = false;
  let group = null;
  let card = null;
  let mode = null; // 'q' | 'a'

  const flushCard = () => {
    if (card && group) group.cards.push(card);
    card = null;
    mode = null;
  };
  const flushGroup = () => {
    flushCard();
    if (group && group.cards.length) groups.push(group);
    group = null;
  };

  for (const line of lines) {
    const fence = FENCE.test(line);
    if (!inFence && !fence && /^##\s+\S/.test(line)) {
      flushGroup();
      group = { title: line.replace(/^##\s+/, '').trim(), cards: [] };
      continue;
    }
    if (!inFence && !fence && /^Q:\s?/.test(line)) {
      flushCard();
      card = { q: line.replace(/^Q:\s?/, ''), a: [] };
      mode = 'q';
      continue;
    }
    if (!inFence && !fence && /^A:\s?/.test(line)) {
      mode = 'a';
      if (card) card.a.push(line.replace(/^A:\s?/, ''));
      continue;
    }
    if (fence) inFence = !inFence;
    if (!card) continue;
    if (mode === 'q' && !inFence && line.trim() === '') {
      // blank line right after a one-line Q with no A yet: keep waiting
    }
    if (mode === 'a') card.a.push(line);
    else if (mode === 'q' && line.trim() !== '') card.q += '\n' + line;
  }
  flushGroup();

  return groups.map((g) => ({
    title: g.title,
    cards: g.cards.map((c) => ({ prompt: c.q.trim(), example: c.a.join('\n').trim() })),
  }));
}

// ---------------------------------------------------------------------------
// 3. Match each flashcard group to the best note section by token overlap.
//    Tokens come from the note title vs. (group title + its Q prompts), so the
//    bilingual Polish/English cards still latch onto the English note headings.
//    Fallback: round-robin across notes so every card lands on a real note.
// ---------------------------------------------------------------------------
const STOP = new Set(['the', 'a', 'an', 'vs', 'and', 'or', 'of', 'in', 'to', 'i', 'w', 'z', 'na', 'do', 'co', 'jak', 'czym', 'się', 'jest', 'dla']);
const SYN = { niemutowalnosc: 'immutability', rekurencja: 'recursion', paradygmaty: 'paradigm', fiszki: '' };

function tokens(str) {
  return str
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźż0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => SYN[t] ?? t)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function matchGroupsToNotes(notes, groups) {
  const noteTokenSets = notes.map((n) => new Set(tokens(n.title)));
  let rr = 0;
  return groups.map((g) => {
    const gTokens = new Set(tokens(g.title + ' ' + g.cards.map((c) => c.prompt).join(' ')));
    let best = -1;
    let bestScore = 0;
    noteTokenSets.forEach((set, i) => {
      let score = 0;
      for (const t of gTokens) if (set.has(t)) score++;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best === -1) best = rr++ % notes.length;
    return { ...g, noteIndex: best };
  });
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------
function dq(str) {
  // dollar-quote with a tag guaranteed not to occur in the content
  let tag = 'seed';
  while (str.includes('$' + tag + '$')) tag += 'x';
  return `$${tag}$${str}$${tag}$`;
}
const pad = (n) => String(n).padStart(12, '0');
// Deterministic v4-shaped ids: version nibble `4` (group 3) + variant nibble `8` (group 4).
// Historically REQUIRED: the id schemas used Zod `z.uuid()` (strict RFC-4122), which rejects
// version-0 ids like `…-0000-0000-…` even though Postgres `uuid` stores them fine — so such
// seed ids silently failed every Server Action mutation. The schemas now validate SHAPE only
// (`z.guid()`, see src/features/memory-cards/schemas.ts), so version-0 ids would also work; we
// keep emitting valid v4 anyway for cleanliness and to match `gen_random_uuid()` output.
const noteId = (i) => `0a7e0000-0000-4000-8000-${pad(i)}`;
const cardId = (i) => `c4ec0000-0000-4000-8000-${pad(i)}`;

// Deterministic 0..99 hash of a SQL text expression — the seed for all review-history
// variation. md5 → take 8 hex chars → bit(32) → signed int → fold to 0..99. `(% 100 + 100) % 100`
// normalizes the sign so negative ints map into range. Stable across `db reset` (no random()).
const H = (seedExpr) => `(('x' || substr(md5(${seedExpr}), 1, 8))::bit(32)::int % 100 + 100) % 100`;

// FSRS profiles cycled across cards so /review (due_at <= now()) and the
// dashboard both light up: a mix of due-now, overdue, and future cards.
// [state, stability, difficulty, scheduled_days, reps, dueExpr, lastExpr]
function fsrs(j) {
  switch (j % 5) {
    case 0: // New, due now
      return [0, 0, 0, 0, 0, 'now()', 'null'];
    case 1: // Learning, due now
      return [1, 1.2, 5.0, 0, 1, `now() - interval '10 minutes'`, `now() - interval '10 minutes'`];
    case 2: // OVERDUE review
      return [2, 8.0, 5.5, 4, 3, `now() - interval '${1 + (j % 6)} days'`, `now() - interval '${4 + (j % 6)} days'`];
    case 3: // Review due right now
      return [2, 4.0, 6.0, 2, 2, 'now()', `now() - interval '2 days'`];
    default: // Future review, MATURE — stability past the 21-day maturity line (hidden from /review)
      return [2, 45.0, 4.0, 35, 5, `now() + interval '${21 + (j % 14)} days'`, `now() - interval '10 days'`];
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const notes = parseNoteSections(readFileSync(notesFile, 'utf8'));
const groups = parseCards(readFileSync(cardsFile, 'utf8'));
const matched = matchGroupsToNotes(notes, groups);

const out = [];
out.push(`-- ============================================================================`);
out.push(`-- test@gmail.com — REAL-CONTENT playground, generated from learning notes by`);
out.push(`-- supabase/seed-scripts/generate-section-seed.mjs. Replaces the old synthetic`);
out.push(`-- 24-subject/60-note block. Section: ${SUBJECT_TITLE}.`);
out.push(`-- Source notes: ${notesFile.replace(repoRoot, '<repo>')}`);
out.push(`-- Source cards: ${cardsFile.replace(repoRoot, '<repo>')}`);
out.push(`-- ${notes.length} notes, ${groups.reduce((a, g) => a + g.cards.length, 0)} cards across ${groups.length} card-groups.`);
out.push(`-- ============================================================================`);
out.push('');
out.push(`insert into auth.users (`);
out.push(`  instance_id, id, aud, role, email, encrypted_password,`);
out.push(`  email_confirmed_at, created_at, updated_at,`);
out.push(`  raw_app_meta_data, raw_user_meta_data,`);
out.push(`  confirmation_token, recovery_token, email_change_token_new, email_change`);
out.push(`)`);
out.push(`values (`);
out.push(`  '00000000-0000-0000-0000-000000000000',`);
out.push(`  '${USER_ID}',`);
out.push(`  'authenticated', 'authenticated',`);
out.push(`  'test@gmail.com',`);
out.push(`  crypt('test@Test', gen_salt('bf')),`);
out.push(`  now(), now(), now(),`);
out.push(`  '{"provider":"email","providers":["email"]}', '{}',`);
out.push(`  '', '', '', ''`);
out.push(`)`);
out.push(`on conflict (id) do nothing;`);
out.push('');
out.push(`insert into auth.identities (`);
out.push(`  id, user_id, provider_id, identity_data, provider,`);
out.push(`  created_at, updated_at, last_sign_in_at`);
out.push(`)`);
out.push(`values (`);
out.push(`  gen_random_uuid(),`);
out.push(`  '${USER_ID}',`);
out.push(`  '${USER_ID}',`);
out.push(`  '{"sub":"${USER_ID}","email":"test@gmail.com"}',`);
out.push(`  'email',`);
out.push(`  now(), now(), now()`);
out.push(`)`);
out.push(`on conflict do nothing;`);
out.push('');

// Subject
out.push(`insert into subjects (id, user_id, title, description) values`);
out.push(`  ('${SUBJECT_ID}', '${USER_ID}', ${dq(SUBJECT_TITLE)}, ${dq(SUBJECT_DESC)})`);
out.push(`on conflict (id) do nothing;`);
out.push('');

// Notes
out.push(`insert into notes (id, user_id, title, content, subject_id, position) values`);
out.push(
  notes
    .map(
      (n, i) =>
        `  ('${noteId(i + 1)}', '${USER_ID}', ${dq(n.title)}, ${dq(n.content)}, '${SUBJECT_ID}', ${i + 1})`,
    )
    .join(',\n'),
);
out.push(`on conflict (id) do nothing;`);
out.push('');

// memory_cards
const cardRows = [];
let cardSeq = 0;
for (const g of matched) {
  for (const c of g.cards) {
    cardSeq++;
    const [state, stab, diff, sched, reps, dueExpr, lastExpr] = fsrs(cardSeq);
    cardRows.push(
      `  ('${cardId(cardSeq)}', '${USER_ID}', '${noteId(g.noteIndex + 1)}', '${SUBJECT_ID}', ${dq(c.prompt)}, ${c.example ? dq(c.example) : 'null'},\n` +
        `   ${state}, ${stab}, ${diff}, 0, ${sched}, 0, ${reps}, 0, ${dueExpr}, ${lastExpr})`,
    );
  }
}
out.push(`insert into memory_cards (`);
// subject_id is seeded explicitly (the app owns it; no DB trigger) — every card
// in a generated section belongs to that section's single subject.
out.push(`  id, user_id, note_id, subject_id, prompt, example,`);
out.push(`  state, stability, difficulty, elapsed_days, scheduled_days,`);
out.push(`  learning_steps, reps, lapses, due_at, last_review`);
out.push(`) values`);
out.push(cardRows.join(',\n'));
out.push(`on conflict (id) do nothing;`);
out.push('');

// review_events: ~53 weeks of history so the dashboard heatmap fills the whole grid
// (not a 2-week band) and the streak/retention stats render against real volume.
//
// HISTORY_DAYS spans the heatmap window (53 weeks ≈ 371 days; getReviewActivity fetches 400d back).
// STREAK_DAYS most-recent days are forced ≥ daily-goal (5) so a live streak always shows.
//
// Per day we pick `n` DISTINCT cards — distinct-count is exactly what the heatmap buckets on
// (countToLevel: 0 / 1-5 / 6-10 / 11-15 / 16+). `n` comes from a deterministic hash distribution:
// ~30% rest days, the rest spread across all five levels. Cards are chosen by modular rotation
// `(rn + d*7) % total < n`, which yields precisely `n` distinct cards and rotates the set day-to-day.
// reviewed_at is anchored to noon UTC (+ jitter) so it never crosses the UTC↔APP_TIME_ZONE midnight
// and lands in the wrong day-bucket. Event ids are md5-derived → re-running `db reset` is idempotent.
const HISTORY_DAYS = 371;
const STREAK_DAYS = 12;
out.push(`-- Review history (~53 weeks) for the dashboard heatmap, streak, and retention stats.`);
out.push(`insert into review_events (id, user_id, memory_card_id, rating, reviewed_at)`);
out.push(`with cards as (`);
out.push(`  select id, (row_number() over (order by id) - 1) as rn, count(*) over () as total`);
out.push(`  from memory_cards where user_id = '${USER_ID}'`);
out.push(`),`);
out.push(`day_n as (`);
out.push(`  select g.d, case`);
out.push(`    when g.d < ${STREAK_DAYS} then 5 + (${H(`'goal' || g.d::text`)} % 8)`); // 5..12, always ≥ goal
out.push(`    when ${H(`'act' || g.d::text`)} < 30 then 0`); //                       ~30% rest days
out.push(`    when ${H(`'act' || g.d::text`)} < 60 then 1 + (${H(`'lvl' || g.d::text`)} % 5)`); //  L1
out.push(`    when ${H(`'act' || g.d::text`)} < 82 then 6 + (${H(`'lvl' || g.d::text`)} % 5)`); //  L2
out.push(`    when ${H(`'act' || g.d::text`)} < 95 then 11 + (${H(`'lvl' || g.d::text`)} % 5)`); // L3
out.push(`    else 16 + (${H(`'lvl' || g.d::text`)} % 8)`); //                          L4 (16..23)
out.push(`  end as n`);
out.push(`  from generate_series(0, ${HISTORY_DAYS - 1}) as g(d)`);
out.push(`)`);
out.push(`select`);
out.push(`  md5('rev-' || dn.d::text || '-' || c.rn::text)::uuid,`);
out.push(`  '${USER_ID}',`);
out.push(`  c.id,`);
out.push(`  (case`); // FSRS rating, weighted toward good — flat 1..4 would imply a 25% lapse rate
out.push(`    when ${H(`'rate' || dn.d::text || '-' || c.rn::text`)} < 8 then 1`);
out.push(`    when ${H(`'rate' || dn.d::text || '-' || c.rn::text`)} < 22 then 2`);
out.push(`    when ${H(`'rate' || dn.d::text || '-' || c.rn::text`)} < 80 then 3`);
out.push(`    else 4 end)::smallint,`);
out.push(`  date_trunc('day', now()) - (dn.d || ' days')::interval`);
out.push(`    + interval '12 hours' + ((${H(`'min' || dn.d::text || '-' || c.rn::text`)} * 2) || ' minutes')::interval`);
out.push(`from day_n dn`);
out.push(`join cards c on ((c.rn + dn.d * 7) % c.total) < least(dn.n, c.total)`);
out.push(`on conflict (id) do nothing;`);
out.push('');

process.stdout.write(out.join('\n'));
