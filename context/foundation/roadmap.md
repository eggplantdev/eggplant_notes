---
project: 'Coding Learning Companion'
version: 1
status: draft
created: 2026-06-01
updated: 2026-06-03
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Coding Learning Companion

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

A personal spaced-repetition tool for developers: write markdown notes with syntax-highlighted code, attach "topic checks" (recall prompts), and review them on an adaptive schedule that lengthens after good recalls and shortens after failures. The product **wedge** — the one trait that, if removed, leaves a generic tagged-notes app — is the adaptive recall loop: the scheduling rule is the product, not a bolt-on. v1 is web-only, multi-user with strict per-user data isolation, solo-built against a hard 2026-06-10 deadline.

## North star

**S-03: close the first recall loop** — user reviews a due topic check, self-rates Again/Hard/Good/Easy, and sees the next interval reschedule. This is the validation milestone: it's the first moment the product's core hypothesis (adaptive scheduling drives retention) is proven end-to-end.

> "North star" here means the smallest end-to-end slice whose successful delivery proves the core product hypothesis — placed as early as its prerequisites allow, because everything else only matters if this works. It is not the first slice built (you must create a note and a topic check first), but it is the first slice that _validates the bet_.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                                           | Prerequisites | PRD refs                                    | Status   |
| ---- | ---------------------------- | ------------------------------------------------------------------------------ | ------------- | ------------------------------------------- | -------- |
| F-01 | minimal-auth-and-session     | (foundation) email/password auth + session; gated product routes               | —             | FR-001–005, Access Control                  | done     |
| F-02 | persistence-and-isolation    | (foundation) core tables + RLS isolation scoped by `auth.uid()`                | —             | NFR (isolation), Access Control             | done     |
| S-01 | capture-note-with-code       | create, view, edit, delete, and list notes with highlighted code               | F-01, F-02    | FR-007–011, US-01, NFR (code)               | done     |
| S-02 | attach-topic-checks          | attach, edit, delete, and list topic checks on a note                          | S-01          | FR-012–015, US-01                           | done     |
| S-03 | close-recall-loop            | review a due topic check, self-rate, and see it reschedule                     | S-02, F-02    | FR-016–019, US-01, Bus. Logic               | proposed |
| S-04 | activity-dashboard           | see due-today count, current streak, and a review heatmap                      | S-03          | FR-020–022                                  | proposed |
| S-05 | delete-account-and-data      | delete their account and all owned data from settings                          | F-01, F-02    | FR-006, Access Control                      | done     |
| S-06 | organize-notes-into-subjects | group notes under a subject, order them, read a subject as one document        | S-01          | (post-PRD; dogfooding feedback)             | proposed |
| S-07 | create-note-with-checks      | add topic checks inline while creating a note, in one flow (no redirect first) | S-01, S-02    | FR-007 + FR-012 (UX combination; no new FR) | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme             | Chain                                               | Note                                                                                                                                                                                                               |
| ------ | ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A      | Recall loop       | `F-01` / `F-02` → `S-01` → `S-02` → `S-03` → `S-04` | The critical path to the north star and the primary Success Criterion. `F-01`∥`F-02`.                                                                                                                              |
| B      | Account lifecycle | `S-05`                                              | Depends only on `F-01`+`F-02`; runs parallel to the whole of Stream A.                                                                                                                                             |
| C      | Note organization | `S-01` → `S-06`                                     | Technical prereq is only `S-01`, but **sequenced after the north star (S-03)** by choice — Subjects are organization/comfort, not product validation. Additive (new table + FK), so it slots in cleanly post-S-03. |
| D      | Authoring polish  | `S-01` / `S-02` → `S-07`                            | UX-only refinement of existing capabilities (no new table). Sequenced after S-03. Independent of Stream C.                                                                                                         |

## Baseline

What's already in place in the codebase as of `2026-06-01` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16 + React 19 + Tailwind v4 + shadcn scaffold (`src/app/layout.tsx`, `src/lib/utils.ts`). Default Create-Next-App page only; no product UI.
- **Backend / API:** absent — no routes under `src/app/api`. App Router can host route handlers / server actions; none written.
- **Data:** partial — `@supabase/ssr` + `supabase-js` installed, `supabase/config.toml` present, Supabase project provisioned via Vercel integration (env on prod+preview). No migrations, no client wiring in `src/lib`.
- **Auth:** partial — Supabase Auth available (deps + env), but no middleware, no auth routes/pages, no session helpers.
- **Deploy / infra:** present — Vercel production live (`fra1`), git-connected, CI via Vercel GitHub integration. **No deploy foundation needed** (first prod deploy already done in m1l5).
- **Observability:** absent — no logging / error-tracking deps. Out of v1 scope (not promoted to a foundation; no slice requires it).

## Foundations

### F-01: minimal auth and session

- **Outcome:** (foundation) email + password sign-up / sign-in / sign-out / password reset work; a session is established via `@supabase/ssr` server/client/middleware helpers; unauthenticated requests to product routes redirect to sign-in.
- **Change ID:** minimal-auth-and-session
- **PRD refs:** FR-001, FR-002, FR-003, FR-004, FR-005, Access Control, NFR (auth flows responsive)
- **Unlocks:** every authenticated slice — S-01, S-02, S-03, S-04, S-05 (no "my data" scoping is possible without a session)
- **Prerequisites:** — (Supabase Auth present per Baseline)
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Broken auth blocks all value (PRD Guardrails). Sequenced first because every slice scopes data by the authenticated user. Kept minimal — Supabase handles hashing/reset/email; v1 does not gate on email verification (FR-002), avoiding unverified-state UX.
- **Status:** done

### F-02: persistence and isolation

- **Outcome:** (foundation) first migration creates `notes`, `topic_checks`, `review_events` with Row-Level Security policies scoping every row by `auth.uid()`, plus minimal typed client query helpers; verified by a two-account isolation test.
- **Change ID:** persistence-and-isolation
- **PRD refs:** NFR (persistence-layer isolation), Access Control (per-user isolation), Business Logic (review_events), NFR (data survives closures)
- **Unlocks:** S-01 (notes), S-03 (review_events for the loop), S-05 (owned-data deletion); reduces the launch-gating isolation guardrail to a verified contract
- **Prerequisites:** — (Supabase project present per Baseline)
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Persistence-layer isolation is the #1 PRD guardrail ("no user sees another's data even with an app-layer bug") — enforcing it at the DB via RLS, not app code, is the investment area. Minimal enabler: the three core tables the recall loop needs, not the full v1.1 entity model. Full isolation verification needs F-01's sign-up working (two real accounts).
- **Status:** done

## Slices

### S-01: capture a note with code

- **Outcome:** user can create a note (title + markdown body), view it rendered with code-block syntax highlighting, edit it, delete it (cascading its topic checks), and see a list of all their notes.
- **Change ID:** capture-note-with-code
- **PRD refs:** FR-007, FR-008, FR-009, FR-010, FR-011, US-01, NFR (code rendering preserves token meaning)
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:**
  - Editor/render libraries (CodeMirror 6 + react-markdown/rehype-highlight) are named in `tech-stack.md` but unwired — Owner: `/10x-plan`. Block: no.
- **Risk:** A note that renders code as plain text fails the product premise (NFR). The content-creation layer the entire recall loop sits on; if note CRUD + highlighting isn't solid, nothing downstream is verifiable.
- **Follow-ups (deferred):** list-query pagination + stop over-fetching `content` (impl-review F1) — `getNotes()` is currently unbounded; fold proper `.range()` pagination into a later stage. See `context/archive/2026-06-03-capture-note-with-code/follow-ups/review-fixes.md`.
- **Status:** done

### S-02: attach topic checks

- **Outcome:** user can attach a topic check (question + optional example + optional code context) to a note, edit it, delete it, and see all topic checks on a given note.
- **Change ID:** attach-topic-checks
- **PRD refs:** FR-012, FR-013, FR-014, FR-015, US-01
- **Prerequisites:** S-01
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Topic checks are the unit the recall loop schedules; without them there is nothing to review. Tightly coupled to S-01 (a check belongs to a note) but kept separate so note CRUD ships and is verifiable on its own.
- **Status:** done

### S-03: close the recall loop (NORTH STAR)

- **Outcome:** the dashboard surfaces topic checks due for review; the user reviews one, self-rates Again/Hard/Good/Easy, the system reschedules its next due date via an adaptive algorithm, records a review event, and shows when it is next due.
- **Change ID:** close-recall-loop
- **PRD refs:** FR-016, FR-017, FR-018, FR-019, US-01, Business Logic, NFR (due-on-date-D never dropped), NFR (review flow responsive)
- **Prerequisites:** S-02, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Recall-scheduling algorithm choice — ts-fsrs (FSRS, Anki default) vs SM-2 (`tech-stack.md` defers this to "when the review-loop slice is started"). Owner: `/10x-plan`. Block: no (FR-018 resolution: established implementations integrate trivially; ts-fsrs is the defensible default).
- **Risk:** This slice IS the product hypothesis — the adaptive rule that distinguishes the app from a tagged-notes list. Sequenced as early as its prerequisites (a note with a due topic check) allow. If the loop doesn't feel right, the rest is gymnastics around something that didn't work.
- **Status:** proposed

### S-04: activity dashboard

- **Outcome:** user can see how many topic checks are due today, their current streak (consecutive days with ≥1 review), and a calendar heatmap of review activity over the last 30–90 days.
- **Change ID:** activity-dashboard
- **PRD refs:** FR-020, FR-021, FR-022, NFR (usable down to ~360px mobile)
- **Prerequisites:** S-03
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pulled into MVP because the loop "doesn't feel real" without visualization (FR-020/021 resolution) and the primary Success Criterion checks streak=1 + heatmap after the first review. Downstream of S-03 because it reads `review_events`. Must stay usable on mobile (the heatmap may compress).
- **Status:** proposed

### S-05: delete account and data

- **Outcome:** user can delete their account from settings; deletion removes all owned data — notes, topic checks, review events, and any connected external-LLM credential.
- **Change ID:** delete-account-and-data
- **PRD refs:** FR-006, Access Control (account deletion)
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** A baseline trust requirement and a consequence of the full-ownership-delete behavior the isolation guarantee already implies. Independent of the content flow, so it can be built in parallel with the recall-loop stream; sequenced last on the critical path because it's not required to prove the product.
- **Status:** done

### S-06: organize notes into subjects

- **Outcome:** user can create a **subject** (e.g. "Python — functional programming"), assign notes to it, reorder those notes, and read every note in a subject as one continuous top-to-bottom document — while each note remains individually addressable and editable (its own route, its own topic checks).
- **Change ID:** organize-notes-into-subjects
- **PRD refs:** **none — not in PRD v1.** This is a post-PRD product expansion driven by dogfooding feedback (`.notes`: "notes stacking … a single document divided into pieces"). The author's real notes are long single markdown files split by headings; this slice mirrors that structure (subject = the document, note = a heading section). PRD `## Open Questions` is closed, so this is tracked as a roadmap-level scope addition; fold into PRD v1.1 if it survives.
- **Prerequisites:** S-01 (notes must exist to group)
- **Parallel with:** S-04, S-05 (independent of the recall loop)
- **Sequenced after:** S-03 (north star). Technical prereq is only S-01, but built after the loop is validated — organization is comfort, not the product bet.
- **Blockers:** —
- **Unknowns:**
  - **Ordering strategy** — naive `position int` (renumbers siblings on mid-list insert) vs **fractional indexing / LexoRank** (`position` as orderable text/float; insert-between = one row update, Notion/Jira pattern). Owner: `/10x-plan`. Block: no (fractional indexing is the defensible default for a solo MVP).
  - **`subject_id` nullability** — existing notes have no subject; make `notes.subject_id` nullable (orphan/uncategorized notes stay valid) or backfill a default "Inbox" subject. Owner: `/10x-shape`/`/10x-plan`.
- **Naming lock:** the parent entity is **`subject`** (table `subjects`, `notes.subject_id`). Deliberately NOT "topic" — "topic check" already means the recall prompt; reusing "topic" for the grouping layer would collide. (Decided 2026-06-03.)
- **Shape (provisional, pre-`/10x-shape`):** new `subjects` table (`id`, `user_id default auth.uid()`, `title`, `created_at`, `updated_at`) with per-action RLS scoping by `auth.uid()` mirroring `notes`; `notes` gains `subject_id` (FK→`subjects`, cascade or set-null TBD) + a `position` column; subject detail page renders member notes `order by position` as one document; reorder = update `position`.
- **Risk:** A model change mid-deadline (`main_goal: speed`, hard date 2026-06-10). Additive and low-coupling (no existing slice reads `subjects`), so the risk is schedule, not architecture. Must not displace S-03 — if time compresses, this is the first thing parked to v1.1.
- **Status:** proposed

### S-07: create a note with checks (authoring polish)

- **Outcome:** when creating a note, the user can attach one or more topic checks in the **same flow** and save them together — instead of today's "create note → redirect to detail → then add checks". Pure UX refinement of S-01 + S-02; adds no new capability or table.
- **Change ID:** create-note-with-checks
- **PRD refs:** FR-007 (note create) + FR-012 (attach topic check) combined into one authoring flow. **No new FR** — this re-sequences existing capabilities.
- **Prerequisites:** S-01 (note create), S-02 (topic-check write path)
- **Parallel with:** S-04, S-05, S-06 (independent)
- **Sequenced after:** S-03 (north star). Polish, not product validation.
- **Blockers:** —
- **Why it's not trivial (the FK constraint):** `topic_checks.note_id` is `not null` (FK→`notes`) — a check **cannot exist before its note**. So the flow is: stage checks client-side (unsaved) → on submit, insert the note → get its `id` → insert the staged checks with that `note_id`. Two ordered writes, not one.
- **Unknowns:**
  - **Atomicity** — if the note inserts but the checks fail, you get a note with no checks. Decide: best-effort sequential writes (acceptable for a personal MVP) vs all-or-nothing via a Postgres function / RPC (the `delete_account()` pattern from S-05). Owner: `/10x-plan`. Block: no (best-effort is the speed-first default; RPC only if partial-write proves annoying).
  - **Interaction with the post-create redirect** — today `create-note` does Post/Redirect/Get to `/notes/[id]`. This slice changes the submit handler to also persist staged checks before (or as part of) the redirect. Must preserve PRG (no duplicate-submit on refresh).
- **Risk:** Low — additive UX, no schema change. Main trap is the two-write ordering + atomicity decision above; get that explicit at `/10x-plan`.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                             | Ready for `/10x-plan` | Notes                                                                                                                          |
| ---------- | ---------------------------- | ------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| F-01       | minimal-auth-and-session     | Minimal email/password auth + gated routes        | done                  | Shipped + archived 2026-06-02 → `context/archive/2026-06-02-minimal-auth-and-session/`                                         |
| F-02       | persistence-and-isolation    | Core schema + RLS per-user isolation              | done                  | Shipped + archived 2026-06-03 → `context/archive/2026-06-02-persistence-and-isolation/`                                        |
| S-01       | capture-note-with-code       | Note CRUD with code-block syntax highlighting     | done                  | Shipped + archived 2026-06-03 → `context/archive/2026-06-03-capture-note-with-code/`                                           |
| S-02       | attach-topic-checks          | Topic-check CRUD on a note                        | done                  | Shipped + reviewed + archived 2026-06-03 → `context/archive/2026-06-03-attach-topic-checks/`                                   |
| S-03       | close-recall-loop            | Review loop: due → rate → reschedule (north star) | no                    | After S-02; pick SRS lib at plan                                                                                               |
| S-04       | activity-dashboard           | Dashboard: due count, streak, heatmap             | no                    | After S-03                                                                                                                     |
| S-05       | delete-account-and-data      | Account deletion with full owned-data removal     | done                  | Shipped + archived 2026-06-03 → `context/archive/2026-06-03-delete-account-and-data/`                                          |
| S-06       | organize-notes-into-subjects | Group notes under an ordered, readable Subject    | no                    | After S-03. Post-PRD scope add; shape with `/10x-shape` (model change: new `subjects` table + `notes.subject_id` + `position`) |
| S-07       | create-note-with-checks      | Attach topic checks inline during note creation   | no                    | After S-03. UX polish, no schema change. Trap: `note_id` FK forces two ordered writes — decide atomicity at `/10x-plan`        |

## Open Roadmap Questions

- The recall-scheduling library (ts-fsrs vs SM-2) — a per-slice unknown tracked inside S-03 (non-blocking; resolved at `/10x-plan` time).
- **S-06 sits outside PRD v1.** It was added from dogfooding feedback after the PRD's `## Open Questions` was closed. Decision pending: amend PRD to v1.1 with the Subjects model, or keep it roadmap-only until it proves out. Does not block S-01→S-04.

## Parked

From PRD `## Non-Goals` (explicit v1 exclusions):

- **Import/export from external SRS products** — Why parked: maintenance burden against a third-party format that doesn't fit the note-first design (PRD Non-Goals).
- **Team workspaces / shared decks / collaboration** — Why parked: explicit personal-tool lock for all versions (PRD Non-Goals).
- **Local-first / offline support** — Why parked: v1 is online-only; deferred to maybe-v2 on demand (PRD Non-Goals).
- **Native mobile app** — Why parked: web-only product; responsive web covers mobile (PRD Non-Goals).

Deferred to v1.1 (out-of-MVP, not out-of-product — `main_goal: speed` keeps them off the v1 path):

- **In-app AI code verification + external-LLM credential ("Connect") + companion CLI + programmatic write surface + push/email reminders + tag organization + email-verification gate** — Why parked: PRD defers all of these to v1.1; Access Control already reserves the isolation model so they don't force a refactor later.

## Done

- **F-01: (foundation) email/password auth + session; gated product routes** — Archived 2026-06-02 → `context/archive/2026-06-02-minimal-auth-and-session/`. Lesson: —.
- **F-02: (foundation) first migration creates `notes`, `topic_checks`, `review_events` with Row-Level Security policies scoping every row by `auth.uid()`, plus minimal typed client query helpers; verified by a two-account isolation test.** — Archived 2026-06-03 → `context/archive/2026-06-02-persistence-and-isolation/`. Lesson: —.
- **S-01: create, view, edit, delete, and list notes with highlighted code** — Archived 2026-06-03 → `context/archive/2026-06-03-capture-note-with-code/`. Lesson: deferred list pagination (F1) → `follow-ups/review-fixes.md`.
- **S-05: user can delete their account from settings; deletion removes all owned data — notes, topic checks, review events, and any connected external-LLM credential.** — Archived 2026-06-03 → `context/archive/2026-06-03-delete-account-and-data/`. Lesson: verify Postgres constraints via pg_catalog, not information_schema.
- **S-02: user can attach a topic check (question + optional example + optional code context) to a note, edit it, delete it, and see all topic checks on a given note.** — Archived 2026-06-03 → `context/archive/2026-06-03-attach-topic-checks/`. Lesson: local-GoTrue E2E sign-up flake (don't gate on it).
