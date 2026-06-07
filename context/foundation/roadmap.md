---
project: 'Coding Learning Companion'
version: 2
status: draft
created: 2026-06-01
updated: 2026-06-07
prd_version: 2
main_goal: speed
top_blocker: time
---

# Roadmap: Coding Learning Companion

> Derived from `context/foundation/prd-v2.md` (v2, brownfield re-shape) + the live codebase baseline.
> v1 roadmap archived → `context/foundation/archive/2026-06-03-roadmap.md`.
> Rows are ordered by execution: done block first, then the v1-usable subset in dependency order, then fast-follow.
> **Band** marks the deadline split: `v1-usable` must ship by 2026-06-10; `fast-follow` lands right after; `v2` is post-deadline.

## Vision recap

A personal coding-learning tool: organize markdown notes into **subjects** (a subject reads as one continuous document split into note-sections), attach recall cards to notes, and review them on an adaptive schedule that lengthens after good recalls and shortens after failures. The product **wedge** — the trait that, if removed, leaves a generic notes app — is twofold: the adaptive recall loop (the scheduling rule _is_ the product, not a bolt-on), and keeping each recall card bound to its source note with a card→note path so knowledge stays linked rather than scattered across files. v2 re-shapes the live v1 (flat, ungrouped notes) into this subject-grouped, card-linked shape. Web-only, multi-user with strict per-user isolation, solo-built against a hard 2026-06-10 deadline for a genuinely usable subset.

## North star

**S-03: close the first recall loop** — user reviews a due recall card, self-rates Again/Hard/Good/Easy, and sees the next interval reschedule. This is the validation milestone: the first moment the core hypothesis (adaptive scheduling drives retention) is proven end-to-end. Subjects (S-06) drive _adoption_, but the recall loop _validates the bet_ — so it stays the north star.

> "North star" here means the smallest end-to-end slice whose successful delivery proves the core product hypothesis — placed as early as its prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                      | Outcome (user can …)                                                                                                              | Prerequisites                      | PRD refs                                       | Band           | Status   |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------- | -------------- | -------- |
| F-01 | minimal-auth-and-session       | (foundation) email/password auth + session; gated product routes                                                                  | —                                  | FR-001–005 (v1), Access Control                | —              | done     |
| F-02 | persistence-and-isolation      | (foundation) core tables + RLS isolation scoped by `auth.uid()`                                                                   | —                                  | NFR (isolation), Access Control                | —              | done     |
| S-01 | capture-note-with-code         | create, view, edit, delete, and list notes with highlighted code                                                                  | F-01, F-02                         | FR-007–011 (v1), US-01                         | —              | done     |
| S-02 | attach-topic-checks            | attach, edit, delete, and list memory cards on a note                                                                             | S-01                               | FR-012–015 (v1), US-01                         | —              | done     |
| S-05 | delete-account-and-data        | delete their account and all owned data from settings                                                                             | F-01, F-02                         | FR-006 (v1), Access Control                    | —              | done     |
| S-03 | close-recall-loop              | review a due card, self-rate, and see it reschedule (FSRS)                                                                        | S-02, F-02                         | US-01, Scope:[modified] recall                 | v1-usable      | done     |
| S-04 | activity-dashboard             | see due-today count, current streak, and a review heatmap                                                                         | S-03                               | FR-020–022 (v1)                                | v1-usable      | done     |
| S-10 | app-navigation                 | move between product routes via a persistent top-bar / mobile sheet                                                               | F-01                               | US-01 (navigability)                           | v1-usable      | done     |
| S-06 | organize-notes-into-subjects   | group notes under a subject, order them, read a subject as one document                                                           | S-01                               | US-01, Scope:[new] subjects                    | v1-usable      | done     |
| S-08 | card-to-note-navigation        | jump from a recall card to its source note                                                                                        | S-02                               | US-01, Scope:[new] card→note                   | v1-usable      | done     |
| S-07 | create-note-with-checks        | add memory cards inline while creating a note (no redirect first)                                                                 | S-01, S-02                         | Scope:[new] inline cards (FR-008)              | fast-follow    | done     |
| S-09 | authoring-refinements          | defer title-validation errors; select a code language when creating                                                               | S-01                               | Scope (FR-009, FR-010)                         | fast-follow    | done\*   |
| S-16 | action-feedback-toasts         | get a toast on every mutation — errors scream (viewport-fixed), successes confirm                                                 | F-01, S-01, S-02, S-03, S-05, S-06 | NFR (feedback/usability)                       | fast-follow    | done     |
| S-11 | data-fetching-efficiency       | navigate between routes without refetching unchanged data; lists stop over-fetching                                               | S-01, S-02, S-06                   | NFR (responsiveness); S-01/S-02 follow-ups     | v2             | proposed |
| S-12 | seed-sample-data               | one-click load + clear of the existing seed corpus, re-scoped to the current user, to demo the whole app                          | all slices / schema frozen         | US-01 (first-run); course-eval demo affordance | v2 (final)     | done     |
| S-13 | shiki-lang-source-of-truth     | (perf) code highlighting loads a curated language set with fast cold start; picker + highlighter share one source of truth        | S-01, S-06                         | NFR (code rendering, responsiveness)           | v2             | done     |
| S-14 | inline-edit-notes-and-subjects | edit a note or subject in place (light read-only default); no separate edit page                                                  | S-01, S-02, S-06                   | US-01 (authoring ergonomics)                   | v2             | done     |
| S-15 | subject-sidebar-nav            | browse a subject as a docs-style sidebar (one note per pane); reorder notes via a drag handle                                     | S-14, S-06                         | US-01 (subject navigation)                     | v2             | done     |
| S-17 | topic-checks-listing           | browse all recall cards on a `/memory-cards` page, filtered by subject server-side; jump from a card to its source note           | S-02, S-06, S-08                   | US-01, Scope:[new] card→note (listing)         | v2             | done     |
| S-18 | daily-goal-progress-bar        | set a daily-review goal, watch a neon progress bar fill on the dashboard, and get a celebration when the goal is hit              | S-03, S-04                         | US-01 (engagement); net-new UX affordance      | v2             | done     |
| S-19 | import-markdown-to-notes       | bulk-create notes from an uploaded markdown file (deterministic heading-split + preview/edit), optionally with AI-generated cards | S-01, S-06, S-02                   | US-01 (authoring); net-new authoring surface   | v2 (post-ship) | done     |
| S-20 | expose-cli-note-api            | add a note (+ its cards) over HTTP from a CLI/agent skill, authed by a per-device personal API token (mint/revoke/audit)          | S-01, S-02, S-07                   | US-01 (authoring); net-new external surface    | v2 (last)      | proposed |

> \* **S-09 `done*`** — feature-complete and committed, but unlike every other `done` slice it was **not** archived: built ad-hoc (no `/10x-new` change folder), tests skipped per direction, and committed on `dashboard-stats-expansion` (merges to `main` with that branch; the auth-validation half `c4657d3` is already on `main`). See the S-09 detail section.

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below.

| Stream | Theme             | Chain                                               | Note                                                                                                                                                                                                                                                                                              |
| ------ | ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Recall loop       | `F-01` / `F-02` → `S-01` → `S-02` → `S-03` → `S-04` | Critical path to the north star. Both `S-03` and `S-04` are v1-usable; `S-04` rides directly on `S-03` (its `data.ts` seam).                                                                                                                                                                      |
| B      | Knowledge linking | `S-06` / `S-08`                                     | The v2 differentiator: subject grouping (builds on `S-01`) + card→note jump (builds on `S-02`). Both v1-usable, parallel with Stream A.                                                                                                                                                           |
| C      | Authoring polish  | `S-07` / `S-09`                                     | Fast-follow UX refinements; build on `S-01`/`S-02`, no schema change. Land right after the 06-10 subset.                                                                                                                                                                                          |
| F      | Performance       | `S-11`                                              | Cross-cutting, not vertical. v2: caching + access-pattern cleanup over the read paths from `S-01`/`S-02`/`S-06`. No new user feature.                                                                                                                                                             |
| D      | Account lifecycle | `S-05`                                              | Done. Depended only on `F-01`+`F-02`.                                                                                                                                                                                                                                                             |
| E      | App shell         | `S-10`                                              | Done. Persistent nav across the six protected routes; depended only on `F-01`'s `(protected)` shell. Off-plan gap-fill, kept as a slice.                                                                                                                                                          |
| G      | View ergonomics   | `S-14` → `S-15` (+ `S-13`)                          | Post-deadline polish of note/subject reading + editing. In-place edit (`S-14`) → docs-style single-pane subject view (`S-15`, depends on `S-14`); `S-13` cuts markdown-highlight cold-start (curated Shiki langs + lazy). All v2, none critical-path. From TODO Cluster 2/4.                      |
| H      | Feedback          | `S-16`                                              | Cross-cutting UX-quality: uniform `react-toastify` feedback over every Server Action mutation (one imperative hook + one form helper + one `?toast=` post-redirect reader). Not vertical — motivated by a silent `reorderNote` failure caught dogfooding. Builds on every mutation-bearing slice. |

## Baseline

What's already in place in the codebase as of `2026-06-03` (current build state — every core layer is shipped).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16 + React 19 + Tailwind v4 + shadcn + **framer-motion** (`d6ef642`); product UI shipped (notes list/detail/forms, settings, auth pages, dashboard shell) behind a persistent app-nav shell (S-10). An off-roadmap page-shell + motion consistency pass is in progress — spec at `docs/superpowers/specs/2026-06-03-page-shell-and-motion-design.md` (declared not a `/10x` change).
- **Backend / API:** present — Server Actions per feature (`src/features/*/actions`), route handlers under `src/app/api` (auth confirm), injectable table-query helpers (`src/lib/supabase/run-table-query.ts`).
- **Data:** present — 6 migrations: `notes`/`memory_cards`/`review_events` + RLS, account-delete RPC, memory-card content columns, FSRS review-loop migration, subjects + note-ordering (S-06: `subjects` table + `notes.subject_id`/`position` + F1 subject-ownership RLS), `create_note_with_checks` RPC (S-07: atomic note+checks write, `SECURITY INVOKER`). Typed `Database` clients.
- **Auth:** present — email/password via Supabase Auth, `proxy.ts` gating, `(protected)` layout (F-01, archived).
- **Deploy / infra:** present — Vercel, git-connected, prod region `fra1`; local Supabase stack for dev.
- **Observability:** absent — no logging/error-tracking library wired. Not gating any v1-usable slice; left out deliberately.

## Foundations

### F-01: minimal auth and session

- **Outcome:** (foundation) email/password auth + session; product routes gated; every row scopes to the authenticated user.
- **Change ID:** minimal-auth-and-session
- **PRD refs:** FR-001–005 (v1), Access Control
- **Unlocks:** every slice (all data scopes by the authenticated user)
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Broken auth blocks all value. Kept minimal — Supabase handles hashing/reset/email.
- **Status:** done

### F-02: persistence and isolation

- **Outcome:** (foundation) first migration creates `notes`, `memory_cards`, `review_events` with RLS policies scoping every row by `auth.uid()`, plus minimal typed client query helpers; verified by a two-account isolation test.
- **Change ID:** persistence-and-isolation
- **PRD refs:** NFR (persistence-layer isolation), Access Control, Business Logic (review_events)
- **Unlocks:** S-01, S-03 (review_events), S-05, S-06 (subjects scope by the same RLS pattern), S-08
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Persistence-layer isolation is the #1 guardrail; enforced at the DB via RLS, not app code. v2's new `subjects` table must extend this same pattern (Guardrail in PRD v2).
- **Status:** done

## Slices

### S-01: capture a note with code

- **Outcome:** user can create a note (title + markdown body), view it rendered with code-block syntax highlighting, edit it, delete it (cascading its memory cards), and see a list of all their notes.
- **Change ID:** capture-note-with-code
- **PRD refs:** FR-007–011 (v1), US-01, NFR (code rendering preserves token meaning)
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** A note that renders code as plain text fails the product premise. The content layer the whole recall loop sits on.
- **Follow-ups (deferred):** list-query pagination + stop over-fetching `content` — `context/archive/2026-06-03-capture-note-with-code/follow-ups/review-fixes.md`.
- **Status:** done

### S-02: attach memory cards

- **Outcome:** user can attach a memory card (question + optional example + optional code context) to a note, edit it, delete it, and see all memory cards on a given note.
- **Change ID:** attach-topic-checks
- **PRD refs:** FR-012–015 (v1), US-01
- **Prerequisites:** S-01
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Memory cards are the unit the recall loop schedules; without them there is nothing to review. `memory_cards.note_id` is `not null` (FK→`notes`) — this is the association S-08 navigates.
- **Status:** done

### S-05: delete account and data

- **Outcome:** user can delete their account from settings; deletion removes all owned data — notes, memory cards, review events, and any connected external-LLM credential.
- **Change ID:** delete-account-and-data
- **PRD refs:** FR-006 (v1), Access Control (account deletion)
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** A baseline trust requirement. Independent of the content flow.
- **Status:** done

### S-03: close the recall loop (NORTH STAR)

- **Outcome:** the dashboard surfaces memory cards due for review; the user reviews one, self-rates Again/Hard/Good/Easy, the system reschedules its next due date via FSRS, records a review event, and shows when it is next due.
- **Change ID:** close-recall-loop
- **PRD refs:** US-01, PRD v2 Scope:[modified] recall-loop completion, Business Logic Changes, Success Criteria (Guardrail: due cards never dropped)
- **Prerequisites:** S-02, F-02
- **Parallel with:** S-06, S-08 (Knowledge-linking stream is independent of the loop)
- **Blockers:** —
- **Unknowns:**
  - ~~Recall-scheduling algorithm — ts-fsrs vs SM-2.~~ **Resolved (2026-06-03, `/10x-plan`): ts-fsrs (FSRS).** Migration drops SM-2 columns, adds FSRS state, changes `review_events.rating` 0–5 → 1–4. Plan: `context/changes/close-recall-loop/`.
- **Risk:** This slice IS the product hypothesis. Sequenced as early as prerequisites allow. Shipped without breaking scheduling (Guardrail held).
- **Status:** done (archived 2026-06-03 → `context/archive/2026-06-03-close-recall-loop/`)

### S-04: activity dashboard

- **Outcome:** user can see how many memory cards are due today, their current streak (consecutive days with ≥1 review), and a calendar heatmap of review activity over the last 30–90 days.
- **Change ID:** activity-dashboard
- **PRD refs:** FR-020–022 (v1), NFR (usable down to ~360px mobile)
- **Prerequisites:** S-03
- **Parallel with:** S-06, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** v1-usable: the dashboard shell merged to `main` (`587d95b`) and S-03 wired its `features/dashboard/data.ts` seam to real reviews (`4828dbc`), so it rode directly on the north star. Streak extracted to a unit-testable `streak.ts` with a grace-day rule (`src/features/review-events/streak.ts`). The loop "doesn't feel real" without the due-count/streak/heatmap visualization (original MVP rationale). Must stay usable on mobile.
- **Status:** done

### S-10: persistent app navigation

- **Outcome:** the `(protected)` shell carries a persistent top-bar nav linking the six product routes (`/dashboard`, `/notes`, `/review`, `/subjects`, `/settings`, …) with active-route highlighting; on mobile (~360px) it collapses to a floating hamburger that opens a sheet. Sign-out lives in the shell.
- **Change ID:** app-navigation
- **PRD refs:** US-01 (navigability) — off-plan gap-fill, not a new PRD scope item
- **Prerequisites:** F-01 (the `(protected)` layout it mounts into)
- **Parallel with:** S-04, S-06, S-08 (presentational shell, independent of every data slice)
- **Blockers:** —
- **Unknowns:** —
- **As-built deltas (superseded the plan):** no "Companion" wordmark (redundant with the Dashboard link); Subjects ships as a normal live link (its routes already render with S-06 in flight), not disabled; mobile drops the bar entirely (`hidden md:block`) for a `fixed` floating hamburger + `pt-14 md:pt-0` content offset. E2E + formal manual verification waived by decision (presentational, no-schema).
- **Risk:** Very low — presentational, no schema. Added because six routes with only ad-hoc per-page links was real friction once S-06 subjects landed.
- **Status:** done (archived 2026-06-03 → `context/archive/2026-06-03-app-navigation/`)

### S-06: organize notes into subjects

- **Outcome:** user can create a **subject** (e.g. "Python — functional programming"), assign notes to it, reorder those notes, and read every note in a subject as one continuous top-to-bottom document — while each note remains individually addressable and editable (its own route, its own memory cards). A note may belong to one subject or to none.
- **Change ID:** organize-notes-into-subjects
- **PRD refs:** US-01, PRD v2 Scope:[new] subjects + subject-as-document reading (shape FR-001–004)
- **Prerequisites:** S-01 (notes must exist to group)
- **Parallel with:** S-03, S-04, S-08, S-05 (independent of the recall loop)
- **Blockers:** —
- **Unknowns:**
  - **Ordering strategy** — naive `position int` (renumbers siblings on mid-list insert) vs **fractional indexing / LexoRank** (orderable text/float; insert-between = one row update). Owner: `/10x-plan`. Block: no (fractional indexing is the defensible default).
  - **`subject_id` nullability** — make `notes.subject_id` nullable (unassigned notes stay valid) or backfill a default "Inbox" subject. Owner: `/10x-plan`. Block: no.
  - **Subject-delete behavior** — on subject delete, detach member notes (set-null) vs cascade-delete them. Owner: `/10x-plan`. Block: no.
- **Naming lock:** the parent entity is **`subject`** (table `subjects`, `notes.subject_id`). Deliberately NOT "topic" — "memory card" already means the recall prompt.
- **Clean-change note:** no real data exists yet (PRD v2 Constraints), so the schema change can be made cleanly — no migration/backfill burden.
- **Risk:** A model change inside the deadline window (`main_goal: speed`). Additive and low-coupling; the risk is schedule, not architecture. v1-usable because reading-as-one-document is the structural reason the operator would switch off `/workspace/learning`.
- **Status:** done (archived 2026-06-03 → `context/archive/2026-06-03-organize-notes-into-subjects/`)

### S-08: jump from a card to its source note

- **Outcome:** from a recall card — in the due-review loop and in any card list — the user can open the card's source note in one action.
- **Change ID:** card-to-note-navigation
- **PRD refs:** US-01, PRD v2 Scope:[new] card→note navigation
- **Prerequisites:** S-02 (the `memory_cards.note_id` association already exists)
- **Parallel with:** S-03, S-04, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Very low — UI only. The data link (`memory_cards.note_id`, `not null`, indexed) already exists; this slice adds a navigation affordance and a route, no schema change. The card→note path is the v2 differentiator, so it's v1-usable despite being small.
- **Status:** done (archived 2026-06-03 → `context/archive/2026-06-03-card-to-note-navigation/`)

### S-07: create a note with checks (authoring polish)

- **Outcome:** when creating a note, the user can attach one or more memory cards in the **same flow** and save them together — instead of today's "create note → redirect to detail → then add checks".
- **Change ID:** create-note-with-checks
- **PRD refs:** PRD v2 Scope (fast-follow) [new] inline card creation (shape FR-008), US-01
- **Prerequisites:** S-01 (note create), S-02 (memory-card write path)
- **Parallel with:** S-09, S-06, S-08
- **Blockers:** —
- **Why it's not trivial (the FK constraint):** `memory_cards.note_id` is `not null` — a check cannot exist before its note. Flow: stage checks client-side → insert the note → insert staged checks with the new `note_id`. Two ordered writes.
- **Unknowns:**
  - **Atomicity** — note inserts but checks fail
    → note with no checks. Best-effort sequential vs all-or-nothing RPC. Owner: `/10x-plan`. Block: no.
  - **PRG interaction** — preserve Post/Redirect/Get (no duplicate-submit on refresh).
- **Risk:** Low — additive UX, no schema change. Fast-follow: it makes daily authoring smoother but isn't required to cross the adoption line.
- **Status:** done (archived 2026-06-03 → `context/archive/2026-06-03-create-note-with-checks/`)

### S-09: authoring refinements

- **Outcome:** title validation no longer shows an error while the user is still typing (defer to blur/submit); and the user can select a code language when creating a note.
- **Change ID:** authoring-refinements
- **PRD refs:** PRD v2 Scope (fast-follow): [modified] defer validation (shape FR-009) + [new] language select (shape FR-010)
- **Prerequisites:** S-01
- **Parallel with:** S-07, S-06, S-08
- **Blockers:** —
- **Unknowns (resolved):**
  - **Language-select scope** — resolved to **neither metadata nor default-highlight**: the picker is an action that appends a fenced ` ```lang ` code block to the body (the fence already drives Shiki per-block highlighting). No `notes.language` column, no schema change.
- **Risk:** Trivial. Two small dogfooding nits bundled into one slice; fast-follow.
- **Status:** done (implemented + committed, **not** archived — built ad-hoc without a `/10x-new` change folder). FR-009 = auth-form validators flipped `onChange`→`onBlur`+`onSubmit` (the eager errors were on the auth pages, not the note title, which was already deferred in S-01). FR-010 = code-language picker that appends a fenced block. En route, the searchable select was promoted to a reusable `src/components/ui/combobox.tsx` primitive (cmdk + Popover) and the note's **subject** picker was migrated onto it too. Slice-review gate ran (4-check fan-out + `/simplify`); **tests skipped per direction**. Commits `6d0a1a7` (combobox primitive) + `18fcf94` (note-form wiring) on branch `dashboard-stats-expansion` (rides to `main` with that branch); auth validation fix `c4657d3` is already on `main`. **Post-merge enhancement (`cd4634d`):** the code-language picker was extracted to a shared `src/components/markdown/code-block-inserter.tsx` (+ `code-languages.ts`, moved out of `features/notes/constants.ts`) and reused in the **memory-card** code-context editors too — the S-07 inline staged rows on `/notes/new` and the `?edit` memory-card form — so code insertion is consistent across the note body and all check editors.

### S-12: seed sample data (course-eval demo affordance — FINAL slice)

- **Why this exists (rationale):** this is a **course project that will be graded by tutors**. They need to see the whole product working — subjects, notes-with-code, memory cards, the recall loop, the dashboard — **without** spending an hour hand-entering data first. S-12 gives a fresh evaluator a one-click path to a fully-populated, representative account, then a one-click path back to empty. It is a **demo/PoC affordance**, not a generic onboarding feature.
- **SEQUENCING — do this LAST (DECIDED 2026-06-04).** Deferred to the **final slice**, after the data model is frozen. Reason: the chosen mechanism (a `seed_sample_data()` SQL function that reproduces the seed content **column-by-column**) is **tightly coupled to the current schema**. Any later field added to `notes`/`memory_cards`/`subjects`, or any new table, makes the function's explicit column lists go stale — so building it before the schema settles guarantees rework. Build it once, when the shape is final.
- **Outcome:** a signed-in user on an **empty** account (no subjects, no notes — trivially detectable) sees a **"Load sample data"** button in `/settings` and in the existing `/notes` empty state. Clicking it reproduces the **existing `test@gmail.com` seed corpus** (1 subject + ~52 notes with code + ~70 memory cards + ~14 days of review history) **under the current user**, with fresh ids and `is_seeded = true`. Some cards are due immediately, so `/review` works and the dashboard heatmap/streak come alive on load. A paired **"Clear sample data"** button removes only the seeded rows, returning the account to empty.
- **Change ID:** seed-sample-data
- **PRD refs:** US-01 (first-run experience); course-evaluation demo affordance (no existing FR — net-new UX affordance, like S-10)
- **Prerequisites:** S-01, S-02, S-06 — **and (sequencing) all other slices done / data model frozen.** This is the gating reason it's banded last, not a code dependency.
- **Not the dev seed:** distinct from the **dev-only** `supabase/seed.sql` + `generate-section-seed.mjs` (those run on `supabase db reset` as `postgres`, off-Vercel, create fixed `auth.users` accounts). S-12 **reuses the same content** but is **in-app, runtime, per-user, RLS-scoped** — triggered by the signed-in user, inserting under `auth.uid()` (never `user_id` mass-assignment).
- **Design leanings settled in the 2026-06-04 planning session** (carry into the future plan; re-confirm against the frozen schema):
  - **Content:** reproduce the **rich `test@gmail.com` block** (seed.sql lines ~167–1709) — not a hand-curated fixture; it already shows every feature.
  - **Mechanism:** a `seed_sample_data()` Postgres function (`SECURITY INVOKER`, `search_path=''`, grant to `authenticated`) + a `clear_sample_data()` function — mirrors `create_note_with_checks`.
  - **Fresh-id remap (the real gotcha):** seed.sql uses **fixed UUIDs**; reused across users they'd PK-collide. The function must `gen_random_uuid()` per load and remap parent→child via CTEs keyed on the original seed ids (subject→notes→memory_cards). `review_events` needs **no** remap — derive it via `INSERT…SELECT` from the just-inserted seeded checks (seed.sql:1694 already does this).
  - **Marker:** boolean `is_seeded` (default `false`) on `subjects`/`notes`/`memory_cards`; additive, RLS unchanged. Clear = `delete … where is_seeded` on notes (cascade covers checks + review_events) + subjects. review_events needs no marker (cascade).
  - **Gating:** Load shown only when the account is empty (cheap `count: 'exact'` on notes + subjects); `seed_sample_data()` itself **refuses if the account already has rows** (defense-in-depth, prevents double-seed).
  - **Placement:** a "Sample data" section in `/settings` (Load when empty, Clear when seeded data exists) + a Load CTA in the existing `/notes` empty state.
  - **Feedback:** toasts are **not** wired (`react-toastify` installed, unused) — use inline `FormError`/notice + `useTransition` pending state, mirroring the S-05 delete-account dialog.
- **Robustness requirement for the future plan (why it's LAST):** because the function hardcodes the schema's columns, when built it should either (a) be **generated** by extending `seed-scripts/generate-section-seed.mjs` to emit the function body (regenerable when the model changes), or (b) carry an explicit "regenerate after any schema change to the seeded tables" note. Pick this when the schema is frozen.
- **Risk:** Low to build, but **schedule-coupled** — its cost is re-done if built before the data model settles. Hence: last.
- **Status:** done (archived 2026-06-06 → `context/archive/2026-06-06-seed-sample-data/`)

### S-11: data-fetching efficiency (performance — cross-cutting)

- **Outcome:** navigating between product routes no longer refetches data that hasn't changed (today every tab switch re-runs the page's Supabase read because dynamic pages get no client Router Cache), and list views stop pulling columns they don't render. User-perceptible effect: navigation feels instant for unchanged data; list pages load less.
- **Change ID:** data-fetching-efficiency
- **PRD refs:** NFR (responsiveness / usable on mobile); consolidates the deferred S-01 + S-02 query follow-ups
- **Prerequisites:** S-01, S-02, S-06 (the read paths it optimizes must exist)
- **Parallel with:** any v2 item (touches the data-access layer, not features)
- **Not a vertical slice:** kept on the roadmap as a cross-cutting performance change (precedent: S-10 was an off-plan item kept as a slice). Adds no new "user can …" capability.
- **Chosen approach — Next 16 Cache Components:** wrap the per-user reads (`getNotes`, `getSubjects`, `getNotesForSubject`, `getMemoryCardsForNote`) in `'use cache'` with a per-user `cacheTag`, and invalidate precisely from the mutating Server Actions with `updateTag` (read-your-writes) — replacing today's blunt `revalidatePath`. Tag-based event-driven invalidation, not time-based guessing.
- **Folds in (already-deferred follow-ups):**
  - S-01 → `context/archive/2026-06-03-capture-note-with-code/follow-ups/review-fixes.md`: list pagination + stop over-fetching `content` (the notes list selects `*` but renders only titles).
  - S-02 → unbounded per-note memory-card read + Shiki-per-check cost.
- **Unknowns:**
  - **RLS vs `'use cache'` cookie ban (the blocker).** `'use cache'` cannot read request cookies, but RLS scopes rows by `auth.uid()` from the auth cookie. Resolve: pass `userId` as an explicit arg + key the cache `cacheTag(\`notes-${userId}\`)`, and decide whether the cached read keeps an RLS-scoped client or moves to a filtered service-role client (which would drop the #1 guardrail — avoid unless forced). Owner: `/10x-plan`. **Block: yes** — this gates the whole approach.
  - **`cacheComponents` flag scope** — enabling it in `next.config.ts` changes default caching behavior repo-wide (dynamic pages, `<Suspense>` requirements). Confirm it doesn't regress the auth-gated routes. Owner: `/10x-plan`. Block: no.
  - **`staleTimes` stopgap TRIED then REVERTED (2026-06-03).** `experimental.staleTimes { dynamic: 30, static: 180 }` was added and verified noticeably faster on a prod build (revisits within 30s fired no server request), then **removed**: a time-based client cache has no _targeted_ invalidation. `revalidatePath` only clears the path it names, so e.g. rating a card revalidates `/review` but the Dashboard's cached due-count/streak stays stale for up to 30s with no way to invalidate it precisely. Cross-route staleness you can't target is worse than a slow nav. **Conclusion: the felt slowness is not safely fixable with a config stopgap — it needs the real tag-based invalidation this slice delivers (Cache Components + `updateTag`).** So the slice is no longer "deferrable because the stopgap covers it"; the stopgap does NOT cover it.
  - **Still landed (kept):** the `getCurrentUser` `cache()` per-request dedup — layout + dashboard share one `getUser` round-trip. That's request-scoped memoization, not a cross-navigation cache, so it has none of the staleness problem and stays.
- **Risk:** Medium-low. The RLS-vs-cache constraint is the real risk; get it wrong and you either leak cross-user data or cache nothing. **Band note:** still v2 by the operator's call (2026-06-03), but the original deferral rationale ("the `staleTimes` stopgap covers the deadline-window pain") no longer holds — the stopgap was reverted (see Unknowns). The felt slowness simply rides until this slice ships; acceptable for a solo tool, re-band if it becomes a daily-use blocker.
- **Status:** proposed

### S-13: code-highlighting language source of truth (performance)

- **Outcome:** markdown code highlighting loads a **curated** language set instead of all ~200 Shiki grammars, with the code-block picker (`CODE_LANGUAGES`) and the highlighter's `langs` derived from one array so they cannot drift; off-list fences degrade to plain text.
- **Change ID:** shiki-lang-source-of-truth
- **PRD refs:** NFR (code rendering preserves token meaning; responsiveness)
- **Prerequisites:** S-01 (`RenderMarkdown`), S-06 (subject view exercises it heaviest)
- **Parallel with:** any v2 item — independent of S-14/S-15
- **Design + evidence:** `context/changes/shiki-lang-source-of-truth/change.md` — benchmarked boot **3.3s→0.14s**, **129→37MB**, tokenize flat (a boot/memory fix, not per-render). Config `{ langs: SHIKI_LANGS, lazy: true, fallbackLanguage: 'text' }`.
- **Risk:** Low — surgical, isolated, evidence-backed.
- **Status:** done (archived 2026-06-04 → `context/archive/2026-06-04-shiki-lang-source-of-truth/`)

### S-14: in-place editing for notes and subjects

- **Outcome:** the note and subject detail pages edit **in place** — light read-only by default; an `?edit` toggle swaps to the form (body+subject for notes; title/description header for subjects) without navigating away. The separate `/notes/[id]/edit` and `/subjects/[id]/edit` routes are removed.
- **Change ID:** inline-edit-notes-and-subjects
- **PRD refs:** US-01 (authoring ergonomics)
- **Prerequisites:** S-01, S-02 (memory-card inline CRUD stays as-is), S-06 (subject detail)
- **Parallel with:** S-13
- **Design:** `context/changes/inline-edit-notes-and-subjects/change.md` — searchParam-driven (forced by `RenderMarkdown` being server-only); memory cards keep their existing inline `?edit=<checkId>` CRUD; note = 1st / subject = 2nd consumer → promote a shared edit-toggle helper.
- **Foundation for:** S-15 (its light note view makes single-pane click-to-open cheap).
- **Risk:** Low-medium — touches two detail pages + removes two routes; PRG-on-success must survive the route→searchParam move.
- **Status:** done

### S-15: docs-style single-pane subject view with sidebar nav

- **Outcome:** the subject view at `/subjects/[id]` is a docs-style layout — a persistent sidebar lists the notes, clicking one opens it light in the content pane (RSC nested segment, only content streams), and notes reorder by dragging a **dedicated handle** (not the whole row). **As-built:** built first at `/subjects/[id]/read` for A/B, then (operator decision) the A/B resolved in its favor and it **replaced** the continuous "subject-as-document" view — moved up to `/subjects/[id]`, continuous page + orphans deleted.
- **Change ID:** subject-sidebar-nav
- **PRD refs:** US-01 (subject navigation / reading)
- **Prerequisites:** S-14 (light note view), S-06 (subjects + ordering)
- **Parallel with:** —
- **Design:** `context/changes/subject-sidebar-nav/change.md` — `layout.tsx` (sidebar) + nested `[noteId]` segment (vercel/nextjs docs pattern); drag handle separated from the Link row (the Cluster 2 item); virtual scroll deferred (assess-only). Route name (`read`/`browse`/`doc`) not locked.
- **Risk:** Low — no schema. Began as an additive route alongside the continuous view, then replaced it (the continuous view + `ReorderableNoteList` + `getNotesForSubject` were deleted; subject actions ported into the docs layout header).
- **Status:** done (archived 2026-06-04 → `context/archive/2026-06-04-subject-sidebar-nav/`)

### S-16: action feedback toasts (UX-quality — cross-cutting)

- **Outcome:** every mutation surfaces its result uniformly — a failure shows a viewport-fixed error toast (no longer only an inline `<FormError>` that can scroll off-screen) **and** keeps the inline error; a success confirms with a toast. Covers all Server Action call sites (notes, subjects, memory-cards, review, account, reorder, subject-assignment, auth).
- **Change ID:** action-feedback-toasts
- **PRD refs:** NFR (feedback / usability) — net-new UX-quality affordance, no existing FR (like S-10/S-11)
- **Prerequisites:** F-01, S-01, S-02, S-03, S-05, S-06 — every mutation surface it wires onto (it converges existing call sites, so they must exist)
- **Parallel with:** any v2/fast-follow item — touches the action-result plumbing, not features
- **Not a vertical slice:** cross-cutting quality change (precedent: S-10 nav, S-11 perf kept as slices). Adds no new "user can …" capability; makes existing ones legible.
- **Motivation:** a `reorderNote` failure reverted the optimistic UI **completely silently** — its only signal an off-screen inline error below 52 notes (caught dogfooding 2026-06-04). Root cause (seed-UUID `z.uuid()` rejection) fixed separately; this slice closes the _class_ — no mutation can fail or succeed silently again.
- **Design:** three seams so a new action can't regress to silent — (1) extend `useActionTransition` (imperative); (2) a `toastActionResult` form helper each `onSubmit` calls; (3) generalize the existing `?deleted=1`→`DeletedNotice` query-flag into a reusable `?toast=<key>` post-redirect reader for the 10 redirect-on-success actions (closure dies past `redirect()`). `react-toastify@11.1.0` (mirrored from `wykonczymy`), dark theme. Inline `<FormError>` stays (both channels); field-level Zod errors stay inline only; `signOut` left as the one knowingly-silent site. Full plan + reviewed contract: `context/changes/action-feedback-toasts/{plan,plan-brief,research}.md`; plan-review `reviews/plan-review.md` (REVISE → SOUND).
- **Risk:** Low-medium — no schema, but it touches ~14 client/action files across every feature. The real risk is regressing the optimistic-revert / AlertDialog flows during the imperative migration; plan locks `run` returning `ActionResultT` so optimistic sites still revert.
- **Linear:** EX-378 (In Progress, `slice`, Medium).
- **Status:** done (archived 2026-06-04 → `context/archive/2026-06-04-action-feedback-toasts/`)

### S-18: daily goal + today's progress bar (engagement — dashboard)

- **Outcome:** the user sets a daily-review goal in `/settings`; the dashboard shows a bare neon L4 progress bar (distinct cards reviewed today ÷ goal) that fills as they review, hits a glow state at 100%, and shows a `+N bonus` badge past goal; crossing the goal mid-review pops a celebration dialog.
- **Change ID:** daily-goal-progress-bar
- **PRD refs:** US-01 (engagement) — net-new UX affordance, no existing FR (like S-10/S-16)
- **Prerequisites:** S-03 (review events drive the count), S-04 (dashboard surface it mounts onto)
- **Parallel with:** any v2 item — additive, independent of every other slice
- **Not a vertical product slice (TODO Cluster 3):** dashboard engagement polish; adds a small new capability rather than extending the core loop. Design contract: `docs/superpowers/specs/2026-06-04-daily-goal-progress-bar-design.md`.
- **As-built:** new `user_settings` table (`daily_goal int default 10`, RLS by `auth.uid()`); count = distinct `topic_check_id` reviewed today in `APP_TIME_ZONE` (reuses the `getReviewActivity` read pattern); edit via a `features/settings` Server Action mirroring delete-account; goal-crossing detection extracted to `features/review/detect-goal-crossing.ts` (unit-tested) + a `goal-celebration-dialog`. Palette via Tailwind v4 `@theme` tokens. Full per-slice gate ran (review fan-out → `/simplify` → tests → archive).
- **Risk:** Low — additive, no impact on the recall loop or isolation model.
- **Status:** done (archived 2026-06-04 → `context/archive/2026-06-04-daily-goal-progress-bar/`)

### S-19: import a markdown file into notes (authoring — post-ship)

- **Outcome:** instead of only manual entry, the user uploads a markdown file and gets notes (note-sections under a subject) via a deterministic heading-split they preview and edit before commit; optionally, AI generates recall cards from the imported prose, also preview-gated.
- **Change ID:** import-markdown-to-notes
- **PRD refs:** US-01 (authoring ergonomics) — net-new authoring surface, no existing FR (like S-10/S-16/S-18)
- **Prerequisites:** S-01 (notes), S-06 (subject to import into + ordering), S-02 (memory cards, for the AI card-gen); F-01/F-02 (per-user RLS-scoped credential storage for the OpenRouter key)
- **Parallel with:** any post-ship item — additive, no impact on the recall loop or isolation
- **Parked — NOT deadline work.** Extra surface to pick up only after the basic version ships.
- **Core insight (two problems, opposite answers):** structural split (markdown → sections) is **deterministic** — the only ambiguity is which heading level is a "note", resolved by letting the user pick + preview, not by guessing. Card/note generation from prose is **not** deterministic — needs an LLM, so it must be preview-gated. The existing `generate-section-seed.mjs` does NOT generalize (hard-codes H1-split + a separate parallel flashcards file + the operator's bilingual token-matcher).
- **Chosen approach (bundled, phased — operator 2026-06-06):** the CSV-importer pipeline — `deterministic split (user picks H-level) → preview/edit → optional AI gen (preview-gated) → commit`. **Phase 1** = deterministic import, no AI, no credentials (ships value alone). **Phase 2** = OpenRouter connect + AI generation. AI uses **the user's own OpenRouter account (BYOK) via OAuth PKCE** — matches the `shape-notes.md` locked decision + TODO Cluster 6; NOT a server-side Vercel Gateway key (scrapped suggestion).
- **AI is opt-in, gated to OpenRouter-connected users:** users are _asked_ whether to generate notes/cards with AI; the option appears only if they've connected OpenRouter, else it prompts to connect or they proceed deterministic-only. Never forced, never the default for a non-connected user.
- **Entry point = a button/toggle, NOT a chat window:** a scoped single-shot action → one structured-output LLM call (Zod schema via AI SDK `generateObject`/tool-use, returns already-shaped `{notes, cards}`) → the same preview/edit gate → commit. Chat rejected (stacks conversation state + streaming on the same structured-extraction bottleneck without removing it); conversational "AI authoring" stays a separate future feature.
- **Connect = the heavy part (Cluster 6 "largest surface"):** OAuth PKCE flow + callback route (`src/app/api/`); encrypted-at-rest, per-user, RLS-scoped, server-only key storage (removed on account-delete S-05, which FR-006 already reserves); a server-side OpenRouter client.
- **Open forks (for `/10x-plan`, not resolved):** split-level UX + preview model; **where the AI card's answer goes** (`memory_cards` has no answer column — current seed convention puts it in `example`; carries TODO Cluster 5); subject assignment on import; large-file safety + idempotent re-import; OpenRouter PKCE contract (confirm via live docs at plan time); key encryption mechanism (Supabase Vault vs app-level crypto).
- **Risk:** Medium — Phase 1 is low-risk (no data/isolation impact); Phase 2 adds a real OAuth flow + credential-secret handling (the security-sensitive part). Net-new surface — `/10x-plan` when unparked (this is a slice, **not** a foundation re-shape; do NOT run `/10x-shape`).
- **SCOPE BROADENED (2026-06-07, planning session):** no longer just "import markdown" — it's an **AI-assisted authoring** slice with **5 capabilities**: (1) cards from a note, (2) stand-alone card on a topic, (3) import doc/paste → AI-decompose into N notes, (4) deterministic markdown→notes split (no AI), (5) note on a topic. Two AI primitives (gen-notes, gen-cards) × grounded/ungrounded, + one deterministic split. **4 phases** (deterministic import → OpenRouter connect → gen-cards → gen-notes), each its own gate. Change-id kept stable. Full detail → `change.md` "Scope reshape" + `plan.md` + `plan-brief.md`.
- **Status:** done (archived 2026-06-07 → `context/archive/2026-06-06-import-markdown-to-notes/`)

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                             | Ready for `/10x-plan` | Notes                                                                                                                                                                                                                               |
| ---------- | ---------------------------- | ------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01       | minimal-auth-and-session     | Minimal email/password auth + gated routes        | done                  | Archived 2026-06-02 → `context/archive/2026-06-02-minimal-auth-and-session/`                                                                                                                                                        |
| F-02       | persistence-and-isolation    | Core schema + RLS per-user isolation              | done                  | Archived 2026-06-03 → `context/archive/2026-06-02-persistence-and-isolation/`                                                                                                                                                       |
| S-01       | capture-note-with-code       | Note CRUD with code-block syntax highlighting     | done                  | Archived 2026-06-03 → `context/archive/2026-06-03-capture-note-with-code/`                                                                                                                                                          |
| S-02       | attach-topic-checks          | Memory-card CRUD on a note                        | done                  | Archived 2026-06-03 → `context/archive/2026-06-03-attach-topic-checks/`                                                                                                                                                             |
| S-05       | delete-account-and-data      | Account deletion with full owned-data removal     | done                  | Archived 2026-06-03 → `context/archive/2026-06-03-delete-account-and-data/`                                                                                                                                                         |
| S-03       | close-recall-loop            | Review loop: due → rate → reschedule (north star) | done                  | **v1-usable.** Archived 2026-06-03 → `context/archive/2026-06-03-close-recall-loop/`.                                                                                                                                               |
| S-04       | activity-dashboard           | Dashboard: due count, streak, heatmap             | done                  | **v1-usable.** Archived 2026-06-03 → `context/archive/2026-06-03-activity-dashboard/`. Shell merged (`587d95b`); S-03 wired its `data.ts` seam (`4828dbc`); streak in `streak.ts` + unit test                                       |
| S-10       | app-navigation               | Persistent top-bar nav for the protected shell    | done                  | **v1-usable.** Archived 2026-06-03 → `context/archive/2026-06-03-app-navigation/`. Off-plan gap-fill; presentational, no schema. Commits `199944b`→`5b33243`, `332f94f`                                                             |
| S-06       | organize-notes-into-subjects | Group notes under an ordered, readable Subject    | done                  | **v1-usable.** Archived 2026-06-03 → `context/archive/2026-06-03-organize-notes-into-subjects/`. `subjects` table + nullable ordered `subject_id` (fractional `position`) + dnd-kit reorder + subject-as-document view; EX-368 Done |
| S-08       | card-to-note-navigation      | Jump from a recall card to its source note        | done                  | **v1-usable.** Archived 2026-06-03 → `context/archive/2026-06-03-card-to-note-navigation/`. UI only, no schema — `getDueQueue` embeds `notes(title)`; muted "From: ‹title›" link on `/review` → `/notes/[id]`                       |
| S-07       | create-note-with-checks      | Attach memory cards inline during note creation   | done                  | Fast-follow. Archived 2026-06-03 → `context/archive/2026-06-03-create-note-with-checks/`. Atomic `create_note_with_checks` RPC (note + checks one txn); merged to `main` (`e7ba359`); EX-370 Done                                   |

| S-09 | authoring-refinements | Defer validation error + code-language select | done\* | Fast-follow. **Done but not archived** (ad-hoc, no `/10x-new` folder, tests skipped). On `main`; EX-371 Done. Code-language inserter later reused in memory-card editors
(`cd4634d`) |
| S-11 | data-fetching-efficiency | Cache reads via Cache Components + cut over-fetch | not yet | v2. Cross-cutting perf. **Blocker for `/10x-plan`:** `'use cache'` can't read cookies, RLS needs them — resolve per-user cache keying + client choice first. Folds in S-01/S-02 query follow-ups. `staleTimes` stopgap tried + reverted 2026-06-03 (no targeted invalidation) — felt slowness rides until this slice ships |
| S-12 | seed-sample-data | Load + Clear sample data (course-eval demo) | **deferred — do last** | v2 (**FINAL slice**). For tutor grading — one-click full-app demo + clear. Reuses the `test@gmail.com` seed corpus re-scoped to the current user (fresh ids, `is_seeded` marker, RLS). **Deferred 2026-06-04:** the `seed_sample_data()` SQL function is column-coupled to the schema, so build it LAST (after the data model is frozen) to avoid rework. Design leanings captured in the S-12 detail section; no `change.md`/`plan.md` yet |
| S-13 | shiki-lang-source-of-truth | Curated Shiki langs + single source of truth | done | v2 perf. Archived 2026-06-04 → `context/archive/2026-06-04-shiki-lang-source-of-truth/`. `SHIKI_LANGS` + `{lazy:true, fallbackLanguage:'text'}`; boot 3.3s→0.14s. |
| S-14 | inline-edit-notes-and-subjects | In-place edit for notes + subjects; kill /edit routes | done | v2 UX. Archived 2026-06-04 → `context/archive/2026-06-04-inline-edit-notes-and-subjects/`. searchParam-driven; checks keep inline CRUD; both `/edit` routes removed. |
| S-15 | subject-sidebar-nav | Docs-style single-pane subject view + dnd handle | done | v2 UX. Archived 2026-06-04 → `context/archive/2026-06-04-subject-sidebar-nav/`. `layout` + nested `[noteId]` segment at `/subjects/[id]`; **replaced** the continuous view (deleted) — A/B resolved in its favor. Handle-split reorder, arrow-key nav, sticky/scroll sidebar, mobile sheet, history-back on the note page. |
| S-16 | action-feedback-toasts | Uniform toast feedback on every mutation | done | **EX-378.** Fast-follow UX-quality. Archived 2026-06-04 → `context/archive/2026-06-04-action-feedback-toasts/`. `react-toastify@11.1.0` via 3 seams (`useActionTransition` + `toastActionResult` form helper + `?toast=` post-redirect reader). Motivated by a silent `reorderNote` failure. |
| S-18 | daily-goal-progress-bar | Daily-goal setting + neon progress bar + celebration | done | v2 engagement (TODO Cluster 3). Archived 2026-06-04 → `context/archive/2026-06-04-daily-goal-progress-bar/`. New `user_settings` table (RLS); distinct-cards-today ÷ goal; `detect-goal-crossing.ts` + celebration dialog; on `main` (`5f0b9a7`→`a747126`). Was missing from this roadmap — added 2026-06-06. |
| S-19 | import-markdown-to-notes | AI-assisted authoring (import + generate notes & cards) | done | Archived 2026-06-07 → `context/archive/2026-06-06-import-markdown-to-notes/`. v2 (**post-ship**). **Scope broadened 2026-06-07** from "import markdown" → AI-assisted authoring, **5 capabilities** (cards-from-note, card-on-topic, doc→AI-decompose-notes, deterministic md split, note-on-topic) = 2 AI primitives (gen-notes/gen-cards) × grounded/ungrounded + deterministic split. **4 phases** (deterministic import → OpenRouter BYOK-PKCE connect w/ AES-GCM key storage → gen-cards → gen-notes), each its own gate. `change.md` + `plan.md` + `plan-brief.md` written. Added 2026-06-06; planned 2026-06-07 |

## Open Roadmap Questions

- ~~Recall-scheduling library (ts-fsrs vs SM-2).~~ **Resolved 2026-06-03: ts-fsrs (FSRS).**
- ~~S-06 sits outside the PRD.~~ **Resolved 2026-06-03: folded into PRD v2 (`prd-v2.md`) as a first-class Scope-of-Change item.**
- ~~**Documentation drift (FSRS vs SM-2):** docs still describe the algorithm as SM-2.~~ **Resolved 2026-06-03:** reconciled to FSRS. `tech-stack.md` + `shape-notes.md` updated; `lessons.md` had no SM-2 refs; CLAUDE.md's SM-2 mentions are accurate transition history (SM-2 locked in F-02, reversed by S-03 → FSRS), left as-is. Live archived changes keep SM-2 as a correct point-in-time record.
- **Subjects design decisions** (per-slice unknowns tracked in S-06): ordering representation, `subject_id` nullability, subject-delete behavior. Owner: `/10x-plan`. Block: no.

## Parked

From PRD v2 `## Non-Goals` (deferred to post-deadline v2 — not out of product):

- **Section-level (heading-anchor) card→note linkage + note→cards reverse view** — Why parked: v1 jumps to the note (S-08); anchoring to a heading and the reverse "all cards from this note" view are v2.
- **AI verification of code examples** — Why parked: examples stay plain content for now; automated grading is v2.
- **In-app Anki export** — Why parked: cards stay in-app for the deadline subset; export-as-optional-output is v2.

From PRD v2 `## Non-Goals` (permanent / all-version exclusions):

- **Auth / role-model changes** — Why parked: flat single-role model explicitly unchanged.
- **Team workspaces / shared decks / collaboration** — Why parked: explicit personal-tool lock for all versions.

Carried from v1 (out-of-MVP):

- **Local-first / offline support; native mobile app; import/export from external SRS products** — Why parked: web-only, online-only product (v1 Non-Goals).
- **In-app AI code verification + external-LLM credential ("Connect") + companion CLI + programmatic write surface + push/email reminders + tag organization + email-verification gate** — Why parked: deferred to v2; Access Control already reserves the isolation model so they don't force a refactor.

## Done

- **S-19: the user uploads a markdown file (or pastes prose / a PDF) and gets notes via a deterministic heading-split they preview and edit before commit; optionally, AI (BYOK OpenRouter) generates notes from a doc and recall cards from prose, all preview-gated.** — Archived 2026-06-07 → `context/archive/2026-06-06-import-markdown-to-notes/`. AI-assisted authoring across 8 phases (deterministic split → OpenRouter PKCE connect + AES-GCM key → gen-cards → gen-notes → model select → live catalog → editable dialog → PDF-via-vision). Lesson: AI-integration tests (override-sent-verbatim, PDF file-part) + manual PDF-vision verify deferred to a separate dense-coverage phase (test-plan R3/R4/R5/R7 via M3L4 `/10x-e2e`); PR #1 ↔ `feat/ai-authoring-iter2` reconciliation still open.
- **S-12: one-click Load sample data into an empty account (the `test@gmail.com` seed corpus re-scoped to the current user — fresh ids, `is_seeded` marker, RLS-safe per-user inserts, no service-role) + paired Clear; controls in `/settings` and the `/notes` empty state.** — Archived 2026-06-06 → `context/archive/2026-06-06-seed-sample-data/`. Generated/committed fixture (`sample-data.ts`, dumped from the local DB so prod has no template account); pure unit-tested remap; rollback-on-failure via a shared `is_seeded` delete guarded by `isAccountEmpty`. **On-demand redesign (operator):** dropped the eager gating queries — settings renders both buttons, the actions self-correct (zero queries on render). Built alongside the parallel `list-search-pagination` session (staged by explicit path). Manual 4.5/5.6 deferred; happy-path round-trip covered by a green E2E. Lesson: —.
- **F-01: (foundation) email/password auth + session; gated product routes** — Archived 2026-06-02 → `context/archive/2026-06-02-minimal-auth-and-session/`. Lesson: —.
- **F-02: (foundation) first migration creates `notes`, `memory_cards`, `review_events` with Row-Level Security policies scoping every row by `auth.uid()`, plus minimal typed client query helpers; verified by a two-account isolation test.** — Archived 2026-06-03 → `context/archive/2026-06-02-persistence-and-isolation/`. Lesson: —.
- **S-01: create, view, edit, delete, and list notes with highlighted code** — Archived 2026-06-03 → `context/archive/2026-06-03-capture-note-with-code/`. Lesson: deferred list pagination (F1) → `follow-ups/review-fixes.md`.
- **S-05: user can delete their account from settings; deletion removes all owned data — notes, memory cards, review events, and any connected external-LLM credential.** — Archived 2026-06-03 → `context/archive/2026-06-03-delete-account-and-data/`. Lesson: verify Postgres constraints via pg_catalog, not information_schema.
- **S-02: user can attach a memory card (question + optional example + optional code context) to a note, edit it, delete it, and see all memory cards on a given note.** — Archived 2026-06-03 → `context/archive/2026-06-03-attach-topic-checks/`. Lesson: local-GoTrue E2E sign-up flake (don't gate on it).
- **S-03: the dashboard surfaces memory cards due for review; the user reviews one, self-rates Again/Hard/Good/Easy, the system reschedules its next due date via FSRS, records a review event, and shows when it is next due.** — Archived 2026-06-03 → `context/archive/2026-06-03-close-recall-loop/`. Lesson: promote shared tier on the 2nd consumer (cross-feature import); keep ts-fsrs out of the client bundle.
- **S-04: user can see how many memory cards are due today, their current streak (consecutive days with ≥1 review), and a calendar heatmap of review activity over the last 30–90 days.** — Archived 2026-06-03 → `context/archive/2026-06-03-activity-dashboard/`. Lesson: E2E must build a fresh isolated server — `reuseExistingServer:true` silently hijacks a running `next dev`.
- **S-10: user can move between the six product routes via a persistent top-bar nav (mobile: floating hamburger + sheet), with active-route highlighting and sign-out in the shell.** — Archived 2026-06-03 → `context/archive/2026-06-03-app-navigation/`. Off-plan gap-fill (six routes had only ad-hoc per-page links). Lesson: —.
- **S-07: when creating a note, the user can attach one or more memory cards in the same flow and save them together.** — Archived 2026-06-03 → `context/archive/2026-06-03-create-note-with-checks/`. Atomic `create_note_with_checks` RPC (SECURITY INVOKER, one transaction). Lesson: —.
- **S-06: create a subject, assign notes to it, drag-reorder them, and read the subject as one continuous document — each note still individually editable; subject-delete detaches notes (set-null).** — Archived 2026-06-03 → `context/archive/2026-06-03-organize-notes-into-subjects/`. Fractional `position` + `@dnd-kit`; DB-level subject-ownership RLS (F1). Lesson: dnd-kit `useSortable` spreads `role="button"` onto the element — `getByRole('listitem')` won't match it in E2E.
- **S-08: from a recall card — in the due-review loop and in any card list — the user can open the card's source note in one action.** — Archived 2026-06-03 → `context/archive/2026-06-03-card-to-note-navigation/`. UI only, no schema: `getDueQueue` embeds `notes(title)`; muted "From: ‹title›" link on `/review` → `/notes/[id]`. Lesson: —.
- **S-13: (perf) markdown code highlighting loads a curated language set instead of all ~200 Shiki grammars, with the picker (`CODE_LANGUAGES`) and highlighter `langs` derived from one array; off-list fences degrade to plain text.** — Archived 2026-06-04 → `context/archive/2026-06-04-shiki-lang-source-of-truth/`. `SHIKI_LANGS` + `{lazy:true, fallbackLanguage:'text'}` on `@shikijs/rehype`; boot 3.3s→0.14s, 129→37MB. **Real-world (observed in `next dev`):** a seeded subject/note detail document dropped **~10s → ~2s**. (Mechanism: the grammar boot is a process-global singleton init — it recurs on process start + each HMR/recompile, which dev does constantly, _not_ on every plain request; the truly per-request dev cost is the uncached RSC render + ~140ms tokenize.) Verified S-13 share = the boot removal (3.3s→0.14s, synthetic benchmark); the remaining delta is dev compile/render S-13 didn't touch, and **dev is inflated 3–10× over prod — the ~2s is the dev figure, not the production number** (relative win real, absolute not). Lesson: `text`-fallback emits `--shiki` vars on the `<pre>` only, not token spans — scope highlight assertions to `span[style*="--shiki"]`.
- **S-16: every mutation surfaces a toast — failures show a viewport-fixed error toast (and keep their inline `<FormError>`), successes confirm; converged onto one imperative hook + one form helper + one `?toast=` post-redirect reader so a new action can't regress to silent.** — Archived 2026-06-04 → `context/archive/2026-06-04-action-feedback-toasts/`. `react-toastify` via 3 seams; replaced `?deleted=1`/`DeletedNotice` with the `?toast=<key>` reader; EX-378. Lesson: —.
- **S-14: in-place editing for notes and subjects — light read-only by default; an `?edit` toggle swaps the detail page to the form (body+subject for notes; title/description header for subjects) without navigating away; the separate `/notes/[id]/edit` and `/subjects/[id]/edit` routes are removed.** — Archived 2026-06-04 → `context/archive/2026-06-04-inline-edit-notes-and-subjects/`. Built in a worktree off `eb394bf`; review fan-out all APPROVED/PASS, `/simplify` no-op. Both E2E specs verified green locally; suite-wide green now rides on S-16's merged auth-toast assertion fixes (to confirm post-merge). Lesson: multi-editor pages break the shared `fillEditor` `.cm-content` locator — scope to `.first()`.
- **S-15: the subject view at `/subjects/[id]` is a docs-style single-pane layout — a persistent titles-only sidebar (Link rows + dedicated mouse-only grip handle, arrow-key nav, sticky+scroll, mobile sheet) + a nested `[noteId]` segment that server-renders one note's read-only body; reorder persists via the existing fractional `reorderNote`.** — Archived 2026-06-04 → `context/archive/2026-06-04-subject-sidebar-nav/`. **As-built:** began at `/subjects/[id]/read` for A/B, then (operator decision) **replaced** the continuous "subject-as-document" view — moved up to `/subjects/[id]`, continuous page + `ReorderableNoteList` + `getNotesForSubject` deleted, subject actions ported into the docs header; note-page back became browser-history "Back" (`PageShell backHistory`). E2E **skipped by operator** (typecheck/lint/unit/build green). Merged to `main` (sidebar `layout.tsx` + nested `[noteId]` segment live). Lesson: —.
- **S-17: browse all recall cards on a `/memory-cards` page, filtered by subject server-side (joining through notes via `notes!inner`); jump from a card to its source note (`#check-<id>`).** — Archived 2026-06-05 → `context/archive/2026-06-05-topic-checks-listing/`. Mirrors the notes listing; promoted `NotesFilter` → shared `SubjectFilter` (2nd consumer); added per-card edit/delete + bottom-aligned card tags via shared `AnimatedCardList`; `formatReviewStatus` + memoized `date.ts` formatter. Review fan-out APPROVED (F1/F2 fixed in `/simplify`). EX-385. E2E env-blocked by the GoTrue sign-up flake (typecheck/lint/unit/build green, manually verified). Lesson: —.
- **S-18: set a daily-review goal in `/settings`, watch a neon L4 progress bar (distinct cards reviewed today ÷ goal) fill on the dashboard with a 100% glow + `+N bonus` overshoot badge, and get a celebration dialog when crossing the goal mid-review.** — Archived 2026-06-04 → `context/archive/2026-06-04-daily-goal-progress-bar/`. New `user_settings` table (RLS by `auth.uid()`, default-10 read-side); reuses the `getReviewActivity` bucket pattern; goal-crossing extracted to unit-tested `detect-goal-crossing.ts`. TODO Cluster 3; on `main` (`5f0b9a7`→`a747126`). **Was absent from this roadmap — backfilled 2026-06-06.** Lesson: —.
