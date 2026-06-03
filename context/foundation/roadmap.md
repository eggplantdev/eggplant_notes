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

| ID   | Change ID                 | Outcome (user can …)                                             | Prerequisites | PRD refs                        | Status   |
| ---- | ------------------------- | ---------------------------------------------------------------- | ------------- | ------------------------------- | -------- |
| F-01 | minimal-auth-and-session  | (foundation) email/password auth + session; gated product routes | —             | FR-001–005, Access Control      | done     |
| F-02 | persistence-and-isolation | (foundation) core tables + RLS isolation scoped by `auth.uid()`  | —             | NFR (isolation), Access Control | done     |
| S-01 | capture-note-with-code    | create, view, edit, delete, and list notes with highlighted code | F-01, F-02    | FR-007–011, US-01, NFR (code)   | done     |
| S-02 | attach-topic-checks       | attach, edit, delete, and list topic checks on a note            | S-01          | FR-012–015, US-01               | proposed |
| S-03 | close-recall-loop         | review a due topic check, self-rate, and see it reschedule       | S-02, F-02    | FR-016–019, US-01, Bus. Logic   | proposed |
| S-04 | activity-dashboard        | see due-today count, current streak, and a review heatmap        | S-03          | FR-020–022                      | proposed |
| S-05 | delete-account-and-data   | delete their account and all owned data from settings            | F-01, F-02    | FR-006, Access Control          | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme             | Chain                                               | Note                                                                                  |
| ------ | ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A      | Recall loop       | `F-01` / `F-02` → `S-01` → `S-02` → `S-03` → `S-04` | The critical path to the north star and the primary Success Criterion. `F-01`∥`F-02`. |
| B      | Account lifecycle | `S-05`                                              | Depends only on `F-01`+`F-02`; runs parallel to the whole of Stream A.                |

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
- **Status:** ready

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
- **Status:** proposed

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
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                             | Ready for `/10x-plan` | Notes                                                                                  |
| ---------- | ------------------------- | ------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| F-01       | minimal-auth-and-session  | Minimal email/password auth + gated routes        | done                  | Shipped + archived 2026-06-02 → `context/archive/2026-06-02-minimal-auth-and-session/` |
| F-02       | persistence-and-isolation | Core schema + RLS per-user isolation              | yes                   | Run `/10x-plan persistence-and-isolation`; ∥ F-01                                      |
| S-01       | capture-note-with-code    | Note CRUD with code-block syntax highlighting     | no                    | After F-01 + F-02                                                                      |
| S-02       | attach-topic-checks       | Topic-check CRUD on a note                        | no                    | After S-01                                                                             |
| S-03       | close-recall-loop         | Review loop: due → rate → reschedule (north star) | no                    | After S-02 + F-02; pick SRS lib at plan                                                |
| S-04       | activity-dashboard        | Dashboard: due count, streak, heatmap             | no                    | After S-03                                                                             |
| S-05       | delete-account-and-data   | Account deletion with full owned-data removal     | no                    | After F-01 + F-02; ∥ content stream                                                    |

## Open Roadmap Questions

None at roadmap scope. PRD `## Open Questions` is closed for v1. The one live decision — the recall-scheduling library — is a per-slice unknown tracked inside S-03 (non-blocking; resolved at `/10x-plan` time).

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
