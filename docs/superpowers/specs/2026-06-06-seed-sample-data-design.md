# Design: Load / Clear Sample Data (S-12)

- **Date:** 2026-06-06
- **Roadmap slice:** S-12 `seed-sample-data` (the deferred "final slice")
- **Status:** design approved, pending implementation plan

## Purpose

This is a course project graded by tutors. They need to see the whole product working —
subjects, notes-with-code, memory cards, the recall loop — **without** hand-entering data
first. S-12 gives a signed-in user on an empty account a one-click **Load sample data**, and a
paired **Clear sample data** to return to empty. It is a demo/PoC affordance, not generic
onboarding.

## Constraints (the binding requirements)

1. **`seed.sql` is the content source** — the existing `test@gmail.com` corpus.
2. **`seed.sql` is never modified** by this feature ("without touching the seed script").
3. **Content is not final** — it will keep changing, so nothing may _duplicate_ it by hand.
4. **Must work on production (Vercel)**, where `seed.sql` never runs and the template account
   does not exist.
5. **Per-user RLS isolation stays the #1 guardrail** — inserts go through the authed RLS
   client under `auth.uid()`, never a service-role client, never `user_id` mass-assignment.

### Why these force a _generated, committed_ fixture

On prod there is no copy of the content anywhere (the `test@gmail.com` template account only
exists where `supabase db reset` ran — i.e. locally). So the content must be _carried_ into the
prod bundle. Because the content keeps changing (constraint 3), the carrier can't be
hand-maintained — it must be **generated from the seed corpus**. A separate generator reads the
content out; `seed.sql` itself is only ever read, never written (constraint 2 holds).

A runtime "copy from the template account" function was rejected: it only works where the
template account exists (local), failing constraint 4.

## Scope of the demo (decided)

**Cards + due-now only.** The fixture carries subjects + notes + cards. No `review_events`, no
FSRS state, no timestamps. Cards load with schema defaults (`state=0` New, `due_at=now()`), so
**every card is due immediately** and `/review` works on load. The dashboard shows the due
count and the populated lists; heatmap, streak, daily-goal bar, and "hardest cards" start empty
(no review history) — accepted.

## Architecture

New feature module `src/features/sample-data/` (feature-first: it spans `/settings` and the
`/notes` empty state, and is its own domain concern):

```
src/features/sample-data/
  sample-data.ts                          # GENERATED typed fixture (committed, ships to prod)
  actions/load-sample-data.ts             # 'use server' loadSampleData()
  actions/clear-sample-data.ts            # 'use server' clearSampleData()
  queries.ts                              # gating reads: account-empty? has-seeded-rows?
  components/sample-data-section.tsx       # Load/Clear UI block for /settings
  components/load-sample-data-button.tsx   # Load CTA reused in the /notes empty state
```

### 1. The fixture + generator

- **Generator:** `supabase/seed-scripts/dump-sample-fixture.mjs`. Connects to the **local**
  Supabase Postgres (`127.0.0.1:54322`, local dev creds) — the existing
  `generate-section-seed.mjs` only parses markdown, so this is a new, independent script that
  does not touch it. Queries the template account
  (`auth.users.id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'`, `test@gmail.com`) for its
  `subjects`, `notes`, and `memory_cards`, and emits `src/features/sample-data/sample-data.ts`.
- **Fixture shape** — content columns only, with synthetic local refs (not DB UUIDs) so the
  loader can remap parent→child at insert time:
  - `subjects[]`: `{ ref, title, description }`
  - `notes[]`: `{ ref, subjectRef | null, title, content, position }`
  - `cards[]`: `{ noteRef, prompt, example | null, codeContext | null }`
  - **Excluded:** all FSRS columns, `due_at`, `created_at`/`updated_at`, `review_events`,
    `user_id`, real `id`s.
- **Regeneration workflow** (the discipline that satisfies constraint 3): edit `seed.sql`
  content → `supabase db reset` → `node supabase/seed-scripts/dump-sample-fixture.mjs` →
  commit the regenerated `sample-data.ts`. A header comment in the generated file states this.

### 2. Marker migration

New migration adds `is_seeded boolean not null default false` to `subjects`, `notes`, and
`memory_cards`. Additive; existing RLS policies unchanged (they already gate the whole row by
`user_id`). The marker scopes the Clear deletion precisely to seeded rows, leaving any rows the
user created themselves untouched.

### 3. `loadSampleData()` Server Action

- RLS client via the project's standard server helper; no service-role key.
- **Guard:** refuse if the account already has any `notes` or `subjects` rows (cheap
  `count: 'exact'`). Defense-in-depth behind the UI gate, prevents double-seed.
- **Insert order with id-remap** (FK + RLS safe):
  1. Insert `subjects` (`is_seeded=true`); map each `ref` → returned `id`.
  2. Insert `notes` with remapped `subject_id`, preserved `position`, `is_seeded=true`; map
     `ref` → returned `id`.
  3. Insert `cards` with remapped `note_id`, `is_seeded=true`. Card scheduling columns are left
     to schema defaults → `state=0`, `due_at=now()` (all due immediately).
- `user_id` is taken from the authed client on every row, never from the fixture.
- **Partial-failure handling:** supabase-js multi-insert is not one transaction. On any step
  error, invoke the clear path to roll back the partial seed, then return the error. Known
  tradeoff, acceptable for a demo affordance.
- Returns `ActionResultT`; surfaces via the standard toast pattern (S-16) + `useTransition`
  pending. `revalidatePath` the affected routes (`/notes`, `/subjects`, `/dashboard`,
  `/settings`).

### 4. `clearSampleData()` Server Action

- `delete … where is_seeded` on `notes` first (cascades their `memory_cards` via the existing
  `note_id on delete cascade`), then on `subjects`. Returns the account to empty.
- Same RLS client, `ActionResultT`, toast + revalidate.

### 5. Gating + placement

- **`/settings`** — a "Sample data" section: **Load** rendered when the account is empty,
  **Clear** rendered when seeded rows exist (`queries.ts` exposes both counts).
- **`/notes` empty state** — a **Load sample data** CTA alongside the existing "Create a note"
  action (the `EmptyState` already takes an `action`; this adds a second one).
- Feedback uses the project-wide toast pattern from S-16 (the roadmap's earlier "inline only"
  note predates toasts being wired) + `useTransition` pending state.

## Data flow

```
edit seed.sql ─▶ db reset ─▶ dump-sample-fixture.mjs ─▶ sample-data.ts (committed)
                                                              │  ships in bundle
                                                              ▼
   user (empty acct) ─click Load─▶ loadSampleData() ─▶ insert subjects→notes→cards
                                                        (remap refs, is_seeded=true, RLS)
   user ─click Clear─▶ clearSampleData() ─▶ delete where is_seeded (notes cascade cards)
```

## Testing

- **Unit:** the id-remap logic (refs → inserted ids; cards land on the right notes) extracted to
  a pure function and tested without the DB.
- **E2E (Playwright):** fresh signup → empty `/notes` shows the Load CTA → click → notes +
  subjects appear, `/review` has a due queue → Clear → account empty again. Gating: Load hidden
  once seeded, Clear hidden once empty.
- Full suite per the per-slice gate (`typecheck`, `lint`, `test`, `test:e2e`, `build`).

## Constraint check

| Constraint                           | Held by                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `seed.sql` untouched                 | dump script only _reads_; never writes `seed.sql`                                     |
| Content sourced from the seed corpus | dump queries the `test@gmail.com` template account                                    |
| Tolerates non-final content          | regenerate the fixture, never hand-edit it                                            |
| Works on prod                        | fixture is a committed module that ships in the bundle                                |
| RLS isolation intact                 | per-user inserts via the authed client; no service-role; no `user_id` mass-assignment |

## Out of scope

- Review history / heatmap-streak liveness (the richer "include review_events" option was not
  chosen).
- A `pg_trgm` or any index work.
- Re-banding S-12 in the roadmap (sequencing note stays: it was the deferred final slice).
