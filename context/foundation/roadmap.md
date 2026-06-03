---
project: 'Coding Learning Companion'
version: 2
status: draft
created: 2026-06-01
updated: 2026-06-03
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

| ID   | Change ID                    | Outcome (user can …)                                                    | Prerequisites | PRD refs                          | Band        | Status   |
| ---- | ---------------------------- | ----------------------------------------------------------------------- | ------------- | --------------------------------- | ----------- | -------- |
| F-01 | minimal-auth-and-session     | (foundation) email/password auth + session; gated product routes        | —             | FR-001–005 (v1), Access Control   | —           | done     |
| F-02 | persistence-and-isolation    | (foundation) core tables + RLS isolation scoped by `auth.uid()`         | —             | NFR (isolation), Access Control   | —           | done     |
| S-01 | capture-note-with-code       | create, view, edit, delete, and list notes with highlighted code        | F-01, F-02    | FR-007–011 (v1), US-01            | —           | done     |
| S-02 | attach-topic-checks          | attach, edit, delete, and list topic checks on a note                   | S-01          | FR-012–015 (v1), US-01            | —           | done     |
| S-05 | delete-account-and-data      | delete their account and all owned data from settings                   | F-01, F-02    | FR-006 (v1), Access Control       | —           | done     |
| S-03 | close-recall-loop            | review a due card, self-rate, and see it reschedule (FSRS)              | S-02, F-02    | US-01, Scope:[modified] recall    | v1-usable   | done     |
| S-04 | activity-dashboard           | see due-today count, current streak, and a review heatmap               | S-03          | FR-020–022 (v1)                   | v1-usable   | proposed |
| S-06 | organize-notes-into-subjects | group notes under a subject, order them, read a subject as one document | S-01          | US-01, Scope:[new] subjects       | v1-usable   | ready    |
| S-08 | card-to-note-navigation      | jump from a recall card to its source note                              | S-02          | US-01, Scope:[new] card→note      | v1-usable   | ready    |
| S-07 | create-note-with-checks      | add topic checks inline while creating a note (no redirect first)       | S-01, S-02    | Scope:[new] inline cards (FR-008) | fast-follow | proposed |
| S-09 | authoring-refinements        | defer title-validation errors; select a code language when creating     | S-01          | Scope (FR-009, FR-010)            | fast-follow | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below.

| Stream | Theme             | Chain                                               | Note                                                                                                                                    |
| ------ | ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Recall loop       | `F-01` / `F-02` → `S-01` → `S-02` → `S-03` → `S-04` | Critical path to the north star. Both `S-03` and `S-04` are v1-usable; `S-04` rides directly on `S-03` (its `data.ts` seam).            |
| B      | Knowledge linking | `S-06` / `S-08`                                     | The v2 differentiator: subject grouping (builds on `S-01`) + card→note jump (builds on `S-02`). Both v1-usable, parallel with Stream A. |
| C      | Authoring polish  | `S-07` / `S-09`                                     | Fast-follow UX refinements; build on `S-01`/`S-02`, no schema change. Land right after the 06-10 subset.                                |
| D      | Account lifecycle | `S-05`                                              | Done. Depended only on `F-01`+`F-02`.                                                                                                   |

## Baseline

What's already in place in the codebase as of `2026-06-03` (current build state — every core layer is shipped).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16 + React 19 + Tailwind v4 + shadcn; product UI shipped (notes list/detail/forms, settings, auth pages, dashboard shell).
- **Backend / API:** present — Server Actions per feature (`src/features/*/actions`), route handlers under `src/app/api` (auth confirm), injectable table-query helpers (`src/lib/supabase/run-table-query.ts`).
- **Data:** present — 4 migrations: `notes`/`topic_checks`/`review_events` + RLS, account-delete RPC, topic-check content columns, FSRS review-loop migration. Typed `Database` clients.
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

- **Outcome:** (foundation) first migration creates `notes`, `topic_checks`, `review_events` with RLS policies scoping every row by `auth.uid()`, plus minimal typed client query helpers; verified by a two-account isolation test.
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

- **Outcome:** user can create a note (title + markdown body), view it rendered with code-block syntax highlighting, edit it, delete it (cascading its topic checks), and see a list of all their notes.
- **Change ID:** capture-note-with-code
- **PRD refs:** FR-007–011 (v1), US-01, NFR (code rendering preserves token meaning)
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** A note that renders code as plain text fails the product premise. The content layer the whole recall loop sits on.
- **Follow-ups (deferred):** list-query pagination + stop over-fetching `content` — `context/archive/2026-06-03-capture-note-with-code/follow-ups/review-fixes.md`.
- **Status:** done

### S-02: attach topic checks

- **Outcome:** user can attach a topic check (question + optional example + optional code context) to a note, edit it, delete it, and see all topic checks on a given note.
- **Change ID:** attach-topic-checks
- **PRD refs:** FR-012–015 (v1), US-01
- **Prerequisites:** S-01
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Topic checks are the unit the recall loop schedules; without them there is nothing to review. `topic_checks.note_id` is `not null` (FK→`notes`) — this is the association S-08 navigates.
- **Status:** done

### S-05: delete account and data

- **Outcome:** user can delete their account from settings; deletion removes all owned data — notes, topic checks, review events, and any connected external-LLM credential.
- **Change ID:** delete-account-and-data
- **PRD refs:** FR-006 (v1), Access Control (account deletion)
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** A baseline trust requirement. Independent of the content flow.
- **Status:** done

### S-03: close the recall loop (NORTH STAR)

- **Outcome:** the dashboard surfaces topic checks due for review; the user reviews one, self-rates Again/Hard/Good/Easy, the system reschedules its next due date via FSRS, records a review event, and shows when it is next due.
- **Change ID:** close-recall-loop
- **PRD refs:** US-01, PRD v2 Scope:[modified] recall-loop completion, Business Logic Changes, Success Criteria (Guardrail: due cards never dropped)
- **Prerequisites:** S-02, F-02
- **Parallel with:** S-06, S-08 (Knowledge-linking stream is independent of the loop)
- **Blockers:** —
- **Unknowns:**
  - ~~Recall-scheduling algorithm — ts-fsrs vs SM-2.~~ **Resolved (2026-06-03, `/10x-plan`): ts-fsrs (FSRS).** Migration drops SM-2 columns, adds FSRS state, changes `review_events.rating` 0–5 → 1–4. Plan: `context/changes/close-recall-loop/`.
- **Risk:** This slice IS the product hypothesis. Sequenced as early as prerequisites allow. Near done — finishing must not break scheduling (Guardrail).
- **Status:** done (archived 2026-06-03 → `context/archive/2026-06-03-close-recall-loop/`)

### S-04: activity dashboard

- **Outcome:** user can see how many topic checks are due today, their current streak (consecutive days with ≥1 review), and a calendar heatmap of review activity over the last 30–90 days.
- **Change ID:** activity-dashboard
- **PRD refs:** FR-020–022 (v1), NFR (usable down to ~360px mobile)
- **Prerequisites:** S-03
- **Parallel with:** S-06, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** v1-usable: the dashboard shell is already merged to `main` (`587d95b`) and the S-03 plan fills its `features/dashboard/data.ts` seam, so it rides directly on the north star and is cheap to finish. The loop "doesn't feel real" without the due-count/streak/heatmap visualization (original MVP rationale). Sequenced immediately after S-03; must stay usable on mobile.
- **Status:** proposed

### S-06: organize notes into subjects

- **Outcome:** user can create a **subject** (e.g. "Python — functional programming"), assign notes to it, reorder those notes, and read every note in a subject as one continuous top-to-bottom document — while each note remains individually addressable and editable (its own route, its own topic checks). A note may belong to one subject or to none.
- **Change ID:** organize-notes-into-subjects
- **PRD refs:** US-01, PRD v2 Scope:[new] subjects + subject-as-document reading (shape FR-001–004)
- **Prerequisites:** S-01 (notes must exist to group)
- **Parallel with:** S-03, S-04, S-08, S-05 (independent of the recall loop)
- **Blockers:** —
- **Unknowns:**
  - **Ordering strategy** — naive `position int` (renumbers siblings on mid-list insert) vs **fractional indexing / LexoRank** (orderable text/float; insert-between = one row update). Owner: `/10x-plan`. Block: no (fractional indexing is the defensible default).
  - **`subject_id` nullability** — make `notes.subject_id` nullable (unassigned notes stay valid) or backfill a default "Inbox" subject. Owner: `/10x-plan`. Block: no.
  - **Subject-delete behavior** — on subject delete, detach member notes (set-null) vs cascade-delete them. Owner: `/10x-plan`. Block: no.
- **Naming lock:** the parent entity is **`subject`** (table `subjects`, `notes.subject_id`). Deliberately NOT "topic" — "topic check" already means the recall prompt.
- **Clean-change note:** no real data exists yet (PRD v2 Constraints), so the schema change can be made cleanly — no migration/backfill burden.
- **Risk:** A model change inside the deadline window (`main_goal: speed`). Additive and low-coupling; the risk is schedule, not architecture. v1-usable because reading-as-one-document is the structural reason the operator would switch off `/workspace/learning`.
- **Status:** ready

### S-08: jump from a card to its source note

- **Outcome:** from a recall card — in the due-review loop and in any card list — the user can open the card's source note in one action.
- **Change ID:** card-to-note-navigation
- **PRD refs:** US-01, PRD v2 Scope:[new] card→note navigation
- **Prerequisites:** S-02 (the `topic_checks.note_id` association already exists)
- **Parallel with:** S-03, S-04, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Very low — UI only. The data link (`topic_checks.note_id`, `not null`, indexed) already exists; this slice adds a navigation affordance and a route, no schema change. The card→note path is the v2 differentiator, so it's v1-usable despite being small.
- **Status:** ready

### S-07: create a note with checks (authoring polish)

- **Outcome:** when creating a note, the user can attach one or more topic checks in the **same flow** and save them together — instead of today's "create note → redirect to detail → then add checks".
- **Change ID:** create-note-with-checks
- **PRD refs:** PRD v2 Scope (fast-follow) [new] inline card creation (shape FR-008), US-01
- **Prerequisites:** S-01 (note create), S-02 (topic-check write path)
- **Parallel with:** S-09, S-06, S-08
- **Blockers:** —
- **Why it's not trivial (the FK constraint):** `topic_checks.note_id` is `not null` — a check cannot exist before its note. Flow: stage checks client-side → insert the note → insert staged checks with the new `note_id`. Two ordered writes.
- **Unknowns:**
  - **Atomicity** — note inserts but checks fail → note with no checks. Best-effort sequential vs all-or-nothing RPC. Owner: `/10x-plan`. Block: no.
  - **PRG interaction** — preserve Post/Redirect/Get (no duplicate-submit on refresh).
- **Risk:** Low — additive UX, no schema change. Fast-follow: it makes daily authoring smoother but isn't required to cross the adoption line.
- **Status:** proposed

### S-09: authoring refinements

- **Outcome:** title validation no longer shows an error while the user is still typing (defer to blur/submit); and the user can select a code language when creating a note.
- **Change ID:** authoring-refinements
- **PRD refs:** PRD v2 Scope (fast-follow): [modified] defer validation (shape FR-009) + [new] language select (shape FR-010)
- **Prerequisites:** S-01
- **Parallel with:** S-07, S-06, S-08
- **Blockers:** —
- **Unknowns:**
  - **Language-select scope** — does the selected language set the default highlight language for the note's code blocks, or is it metadata only? Owner: `/10x-plan`. Block: no.
- **Risk:** Trivial. Two small dogfooding nits bundled into one slice; fast-follow.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                             | Ready for `/10x-plan` | Notes                                                                                                           |
| ---------- | ---------------------------- | ------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| F-01       | minimal-auth-and-session     | Minimal email/password auth + gated routes        | done                  | Archived 2026-06-02 → `context/archive/2026-06-02-minimal-auth-and-session/`                                    |
| F-02       | persistence-and-isolation    | Core schema + RLS per-user isolation              | done                  | Archived 2026-06-03 → `context/archive/2026-06-02-persistence-and-isolation/`                                   |
| S-01       | capture-note-with-code       | Note CRUD with code-block syntax highlighting     | done                  | Archived 2026-06-03 → `context/archive/2026-06-03-capture-note-with-code/`                                      |
| S-02       | attach-topic-checks          | Topic-check CRUD on a note                        | done                  | Archived 2026-06-03 → `context/archive/2026-06-03-attach-topic-checks/`                                         |
| S-05       | delete-account-and-data      | Account deletion with full owned-data removal     | done                  | Archived 2026-06-03 → `context/archive/2026-06-03-delete-account-and-data/`                                     |
| S-03       | close-recall-loop            | Review loop: due → rate → reschedule (north star) | done                  | **v1-usable.** Archived 2026-06-03 → `context/archive/2026-06-03-close-recall-loop/`.                           |
| S-04       | activity-dashboard           | Dashboard: due count, streak, heatmap             | no                    | **v1-usable.** Shell merged (`587d95b`); S-03 fills its `data.ts` seam. Finish right after S-03                 |
| S-06       | organize-notes-into-subjects | Group notes under an ordered, readable Subject    | yes                   | **v1-usable.** `/10x-plan organize-notes-into-subjects` — model change: `subjects` table + `subject_id` + order |
| S-08       | card-to-note-navigation      | Jump from a recall card to its source note        | yes                   | **v1-usable.** `/10x-plan card-to-note-navigation` — UI only, FK exists                                         |
| S-07       | create-note-with-checks      | Attach topic checks inline during note creation   | yes                   | Fast-follow. Trap: `note_id` FK forces two ordered writes — decide atomicity at `/10x-plan`                     |
| S-09       | authoring-refinements        | Defer validation error + code-language select     | yes                   | Fast-follow. Two small UX nits bundled                                                                          |

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

- **F-01: (foundation) email/password auth + session; gated product routes** — Archived 2026-06-02 → `context/archive/2026-06-02-minimal-auth-and-session/`. Lesson: —.
- **F-02: (foundation) first migration creates `notes`, `topic_checks`, `review_events` with Row-Level Security policies scoping every row by `auth.uid()`, plus minimal typed client query helpers; verified by a two-account isolation test.** — Archived 2026-06-03 → `context/archive/2026-06-02-persistence-and-isolation/`. Lesson: —.
- **S-01: create, view, edit, delete, and list notes with highlighted code** — Archived 2026-06-03 → `context/archive/2026-06-03-capture-note-with-code/`. Lesson: deferred list pagination (F1) → `follow-ups/review-fixes.md`.
- **S-05: user can delete their account from settings; deletion removes all owned data — notes, topic checks, review events, and any connected external-LLM credential.** — Archived 2026-06-03 → `context/archive/2026-06-03-delete-account-and-data/`. Lesson: verify Postgres constraints via pg_catalog, not information_schema.
- **S-02: user can attach a topic check (question + optional example + optional code context) to a note, edit it, delete it, and see all topic checks on a given note.** — Archived 2026-06-03 → `context/archive/2026-06-03-attach-topic-checks/`. Lesson: local-GoTrue E2E sign-up flake (don't gate on it).
- **S-03: the dashboard surfaces topic checks due for review; the user reviews one, self-rates Again/Hard/Good/Easy, the system reschedules its next due date via FSRS, records a review event, and shows when it is next due.** — Archived 2026-06-03 → `context/archive/2026-06-03-close-recall-loop/`. Lesson: promote shared tier on the 2nd consumer (cross-feature import); keep ts-fsrs out of the client bundle.
