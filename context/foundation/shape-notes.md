---
project: "Coding Learning Companion"
context_type: greenfield
created: 2026-05-20
updated: 2026-05-20
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-06-10
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "persona scope"
      decision: "any developer (regardless of solo vs team context) managing their own personal learning — covers both agent-native and non-agent subtypes in v1"
    - topic: "pain category"
      decision: "all four dimensions apply — workflow friction, missing capability, data trapped, forgetting/decay — each maps to a v1 feature"
    - topic: "core insight"
      decision: "AI agents are a first-class interface (terminal write/query/reminders + in-app code verification), not a bolt-on"
    - topic: "tenancy"
      decision: "multi-user (other people can sign up). Auth model is real, not single-tenant."
    - topic: "BYOK / LLM cost model"
      decision: "BYOK via OpenRouter PKCE OAuth — user clicks 'Connect with OpenRouter', authorizes a scoped key billed to their account. $0 LLM cost for the operator. Trust mitigated by OpenRouter-side scoping + user-visible audit + revocability. Server-side LLM calls are fine because the key is scoped at the provider."
    - topic: "app auth method"
      decision: "Email + password only for v1. No third-party auth dependency. Implemented via the backend's built-in auth layer (Supabase Auth is the strong lean). Other methods (GitHub OAuth, magic link) can be added later — multiple methods coexist cleanly via the same auth layer."
    - topic: "role model"
      decision: "Flat — one user type. Each user owns their own notes/prompts/data, no admin UI in v1. Operator-level ops (kill switch, bulk debug) handled via direct DB access until/unless a real need for an admin role emerges."
    - topic: "MVP scope"
      decision: "Spine = sign-up + create note (markdown + code highlighting) + attach recall prompt + return-for-review loop + heatmap + streak counter. Deferred to v1.1: AI code-check, OpenRouter OAuth, companion CLI, REST API for external writes, daily/monthly goals, tags, many-to-many note↔prompt, email/push reminders. Timeline: 3 weeks of after-hours work (estimate ~1.5-2 weeks of actual work + buffer)."
    - topic: "reminder mechanism v1"
      decision: "Pull-based — user opens the app and dashboard shows 'X due'. No email digest, no push, no CLI reminders. Those land in v1.1 once the loop is proven."
    - topic: "email verification v1"
      decision: "Supabase auto-sends verification email at sign-up (default); app does NOT gate access on email_verified status in v1. Zero implementation cost; password reset works for users who verify; verification gate can be flipped on in v1.1 without rework."
    - topic: "product framing"
      decision: "product_type: web-app (CLI is v1.1, doesn't change primary product type). target_scale.users: small (single-digit to handful). timeline_budget: 3 weeks MVP target + soft deadline 2026-06-10 tied to the wager, after-hours work only."
    - topic: "non-goals"
      decision: "v1 explicitly does NOT do: (1) Anki import/export, (2) team workspaces / shared decks / collaboration, (3) local-first / offline support, (4) native mobile app. Beyond the v1.1/v2 deferred queue, these four are 'never sneak back in' lock-outs for v1 scope."
  frs_drafted: 22
  quality_check_status: accepted
---

# Shape Notes — Coding Learning Companion

> Working title only. Final name TBD.
> Seed input: `docs/brainstorm-2026-05-20-coding-learning-companion.md`

## Vision & Problem Statement

Developers accumulate coding notes across many projects, languages, and environments — scattered, write-once, rarely revisited. Notes live in random repo READMEs, Obsidian vaults, scratch files. There's no reminder to come back, no signal for what's retained vs forgotten, and no way to actively verify a concept by writing code that something will grade. Existing tools force a trade: Obsidian/Notion give a knowledge base but no recall layer; Anki gives recall but renders code terribly and has no notes layer; RemNote combines them but treats AI as a bolt-on generator. Knowledge decays silently while the developer rewrites notes they already had.

AI agents already live where many developers spend their day — terminal, Claude Code, Codex, Cursor. The insight: instead of bolting AI onto a notes app, make agent integration a first-class interface that runs alongside a conventional web UI. Notes and recall prompts can be created from the terminal (for agent-native users) or via in-app forms (for everyone else). Code answers inside notes get verified by an AI agent in-app. Reminders and queries can also be issued from the terminal so the recall loop runs in the workflow the user already uses. The cost model is BYOK via OpenRouter PKCE OAuth — each user connects their OpenRouter account once; LLM calls are billed to them, scoped to the app, and revocable. The operator carries no LLM cost and the trust problem dissolves into a standard OAuth scope.

## User & Persona

### Primary persona — developer managing personal coding-learning notes

Audience: developers — any language, any stack, employed or independent — who write coding notes across many projects and want a centralized personal knowledge base with active recall and AI code verification. This is a *personal* tool: even a team-employed developer uses it for their own learning, not to share decks with teammates. Two subtypes are both in v1 scope:

- **Agent-native subtype** — lives in the terminal with Claude Code / Codex / Cursor. Prefers a CLI for note creation, querying, and receiving SRS reminders.
- **Non-agent subtype** — prefers the in-app web UI for everything: manual note creation, manual review, visual dashboard.

The reach moment: developer spent hours learning a concept, wrote notes somewhere, about to forget it because nothing reminds them. They want the system to handle recall scheduling, surface reminders in the surface they already use (terminal or web), and actively verify code answers via AI.

**Pain dimensions (all four confirmed):**
- Workflow friction — gathering + revisiting notes scattered across tools
- Missing capability — no existing tool combines notes + SRS + AI code-check
- Data trapped — notes locked in repos, Obsidian, scratch files; no central query
- Forgetting / decay — no retention signal; knowledge lost without warning

## Success Criteria

### Primary

- A new user can complete the end-to-end recall loop in two sessions without errors: sign up → sign in → create a note with code rendered with syntax highlighting → attach a recall prompt → return after the scheduled interval → complete the review with a self-rating → see the next interval reschedule.
- After the first review, the user's dashboard reflects their activity: heatmap shows the day, streak counter reads 1.

### Secondary

- A user sustains use for ≥ 7 days, with a non-trivial streak (5+ review sessions). Indicates the loop is actually engaging, not just functional.
- A second user (someone other than the operator) signs up and uses the product without intervention.

### Guardrails

- Per-user data isolation enforced at the database layer (RLS): no user ever sees another user's data, even with an application-layer bug.
- Notes and recall prompts persist reliably; nothing silently dropped.
- Due reviews always surface on the dashboard at the scheduled time — the reminder loop never misses a prompt.
- Auth flows (sign-up, sign-in, password reset) all functional. Broken auth blocks all value.
- Markdown code-block rendering preserves syntax highlighting on the languages most relevant to the audience (JS/TS at minimum; Python, Go, Rust as bonus). A note that renders code as plain text fails the product premise.

## User Stories

### US-01: User creates and reviews a recall prompt

- **Given** a signed-in user with no existing notes
- **When** they create a note with a markdown body containing a code block, attach a recall prompt with a question, and return after the prompt's scheduled due date
- **Then** the dashboard shows "1 prompt due", they can complete the review with a self-rating, and the prompt is rescheduled based on the SRS algorithm

#### Acceptance Criteria
- Note's code block renders with syntax highlighting (not plain text)
- Recall prompt persists across sessions
- Due prompts surface on the dashboard exactly when scheduled
- Rating the prompt updates the SRS schedule and records a review event
- Heatmap reflects the review day with appropriate intensity color
- Streak counter increments to 1 after the first review

## Functional Requirements

### Authentication
- FR-001: User can sign up with email + password. Priority: must-have
- FR-002: System sends a verification email at sign-up; the user is NOT required to verify before accessing the app in v1. Priority: must-have
  > Socrates: Counter-argument considered: "gated verification adds onboarding friction without clear v1 benefit for a personal-tool product." Resolution: keep the email send (Supabase default, zero extra cost) but defer the verification gate to v1.1. Saves the "unverified state" UX and confirmation-link redirect handling in v1.
- FR-003: User can sign in with email + password. Priority: must-have
- FR-004: User can reset their password via email link. Priority: must-have
- FR-005: User can sign out. Priority: must-have
- FR-006: User can delete their account from settings; deletion cascades to all owned data. Priority: must-have
  > Socrates: Counter-argument considered: "self-service deletion is meaningful overhead; deletion requests could be handled manually via email until you have real users." Resolution: kept; self-service deletion is a baseline trust requirement, and the cascading delete logic is forced by RLS + foreign-key constraints anyway — only the UI overhead is saved by deferring.

### Notes
- FR-007: User can create a note with a title and markdown body. Priority: must-have
- FR-008: User can view a note rendered with markdown formatting and code-block syntax highlighting. Priority: must-have
- FR-009: User can edit a note's title and body. Priority: must-have
- FR-010: User can delete a note; deletion cascades to attached recall prompts. Priority: must-have
- FR-011: User can see a list of all their notes. Priority: must-have

### Recall prompts
- FR-012: User can attach a recall prompt to a note (question + optional example + optional code-block context). Priority: must-have
- FR-013: User can edit a recall prompt. Priority: must-have
- FR-014: User can delete a recall prompt. Priority: must-have
- FR-015: User can see all prompts attached to a given note. Priority: must-have

### Review loop
- FR-016: System surfaces prompts due for review on the user's dashboard. Priority: must-have
- FR-017: User can review a due prompt and self-rate Again / Hard / Good / Easy. Priority: must-have
- FR-018: System reschedules the prompt using the FSRS algorithm (via `ts-fsrs` npm package) based on the user's rating; new due date persisted. Priority: must-have
  > Socrates: Counter-argument considered: "real SRS adds complexity vs hardcoded intervals (Again→1d, Hard→3d, Good→1w, Easy→1m)." Resolution: use ts-fsrs — Anki's current default since 2023, ~30 min integration, no meaningful complexity over hardcoded intervals. SM-2 was also considered as a middle path but ts-fsrs is the modern choice.
- FR-019: User can see when each prompt is next due. Priority: must-have

### Dashboard / activity
- FR-020: User can see their current streak (consecutive days with at least one review). Priority: must-have
  > Socrates: Counter-argument considered: "streak + heatmap are motivation visualizations; the recall loop works without them." Resolution (applies to FR-020 + FR-021): kept. The user explicitly pulled these into MVP because the loop without visualization doesn't "feel real." Combined cost ~1-1.5 days; offsets v1.1 release pressure on the "show the user it's working" dimension.
- FR-021: User can see a calendar heatmap of their review activity (last 30-90 days). Priority: must-have
  > Socrates: See resolution under FR-020 — challenge was combined for FR-020 + FR-021.
- FR-022: User can see how many prompts are due today. Priority: must-have

## Non-Functional Requirements

- Code blocks in notes render with syntax highlighting that preserves token meaning — keywords, strings, comments, and types are visually distinguishable. A note rendering code as flat-colored text fails the product premise.
- A user cannot see another user's data under any circumstance — isolation is enforced at the persistence layer (so an application-layer bug cannot leak data), not solely in application code.
- A prompt scheduled to be due on date `D` appears in the due-list on date `D` — never silently dropped, never appears earlier than scheduled.
- The dashboard renders usably on viewport widths down to ~360px (mobile). The heatmap may compress; everything else stays usable. Mobile review (checking due-count on the train) is a real use case.
- The review flow (open prompt → see question → rate → see next state) feels responsive — the user perceives the rating action as instant; no multi-second wait between submitting a rating and seeing the next prompt or the "no more due" state.
- Auth flows (sign-up, sign-in, password reset) complete within human-perception timing — no multi-second delays under normal load.
- The user's recall data (notes, prompts, review events, and connected OpenRouter token where applicable) survives normal browser closures, app restarts, and deployments without loss.

## Business Logic

The system schedules each recall prompt's next review date by adapting to the user's self-rated recall performance — making review intervals longer after successful recalls and shorter after failures.

Inputs the rule consumes (as user-facing inputs): the user's self-rating (Again / Hard / Good / Easy) after each review, plus the prompt's review history (timestamps and prior ratings). Output: the date the prompt next appears in the user's due-list. The user encounters this every time the dashboard shows "X prompts due" — that count is entirely driven by the algorithm's scheduling decisions. A failed review reschedules the prompt sooner; a successful one reschedules it later. The system effectively learns each user's pacing per prompt.

This is the domain decision that makes the app non-trivial. Without it, the app degenerates into a tagged-notes list (a worse Obsidian). The rule is the product.

## Access Control

Multi-user. Every user owns their own notes, recall prompts, review history, and connected OpenRouter token; no data is shared between users. One role (regular user) — flat model.

**Sign-up / sign-in (v1):** email + password. The chosen auth layer (Supabase Auth is the strong lean) handles password hashing, password reset, and emails. A verification email is sent at sign-up by default, but app access is NOT gated on verification status in v1 (see FR-002 resolution); the verification gate is deferred to v1.1.

**Connected services (separate from app auth):** OpenRouter PKCE OAuth happens *after* sign-in, as a one-click "Connect with OpenRouter" step in settings. Two states: connected (in-app AI features work — when those features ship in v1.1) or disconnected (in-app AI features are gated behind a "Connect OpenRouter to use" prompt; everything else — notes, recall prompts, manual review, stats — works without it).

**External harness writes (REST API, v1.1):** authenticated per-user via a token the user generates in settings. Used by Claude Code / Codex skills and the companion CLI. Scope: same data as the user's web session; no cross-user access. Not in v1 MVP; design intent captured here so RLS policies don't need refactoring when the API ships.

**Unauthenticated request handling:** any gated route (notes, prompts, dashboard, settings) returns 401 / redirects to sign-in. Public surface: sign-in, sign-up, password reset, marketing landing (if any).

**Per-user data isolation:** enforced at the database layer via row-level security (RLS) — `auth.uid()` policies on every user-owned table, so even an application-layer bug can't expose another user's data. Application code does not become the boundary.

**Account deletion:** user can delete their account from settings; deletion cascades to all their notes, prompts, review events, and the connected OpenRouter token (if any).

## Non-Goals

v1 explicitly does NOT include the following. These are *scope* avoids that block sneaking-back-in; technology avoids (specific frameworks, deployment platforms) belong with `/10x-tech-stack-selector` and are captured in the Forward: tech-stack block.

- **Anki import / export.** Adopting Anki's data model creates a maintenance burden against an external format that doesn't fit this product's note-first three-layer design. May reconsider in v2 if there's real user pull.
- **Team workspaces / shared decks / collaborative notes.** Explicit personal-tool lock for all versions. Each user's data is fully theirs; there is no concept of teams, sharing, or collaboration in any planned version of the product.
- **Local-first / offline support.** v1 is online-only. Offline review (subway, plane) is a real use case that's deferred to maybe v2 if user demand justifies the complexity (PowerSync / ElectricSQL / Dexie.js + manual sync are the typical implementation paths).
- **Native mobile app (iOS / Android).** Web-only product. The web app must be mobile-responsive (per NFR), but no React Native, Expo, native binary, or app-store distribution work in any planned version.

Items already deferred to v1.1 (AI code-check, OpenRouter integration, companion CLI, REST API for external writes, email/push reminders, tag organization, email verification gate) are tracked in the `Forward: v1.1 / v2 deferred scope` block below — they are out-of-MVP rather than out-of-product, so they're not duplicated here.

## Forward: v1.1 / v2 deferred scope (informational — not part of PRD)

Everything below is explicitly out of v1 MVP scope but tracked here so the next iteration has a clear queue:

- **v1.1 — close the gap to "real product":**
  - AI code-check inside notes (requires OpenRouter PKCE OAuth + server-side LLM calls)
  - Companion CLI (write, query, terminal reminders)
  - REST API for external harness writes (per-user bearer tokens)
  - Email daily-digest reminders OR web push notifications
  - Tag organization (flat tags first)
  - Email verification gate (Supabase already sends the email; just flip the gate on)
- **v2 — advanced:**
  - In-app AI generation of notes/prompts (paste lesson → notes + prompts produced)
  - Many-to-many note↔prompt
  - Daily / monthly / weekly goals with user-configured targets
  - Time-spent tracking
  - Anki import/export
  - Local-first / offline support

## Forward: forecast / the wager (informational — not part of PRD)

At the user's request, the LLM records its honest single-number estimate for MVP completion alongside the user's. On the actual ship date we measure who was closer.

**The wager (recorded 2026-05-20):**

| Predictor | Single-number forecast (after-hours, calendar weeks) | Distribution brackets |
|-----------|------------------------------------------------------|-----------------------|
| User      | **3 weeks**                                          | (single number; no brackets recorded) |
| LLM       | **5 weeks**                                          | p10: 3 wk · p50: 5 wk · p90: 9 wk |

**LLM's reasoning (recorded for accountability):**

- Line-item hour estimates assume ts-fsrs / Supabase familiarity the user hasn't explicitly confirmed. First-time Supabase RLS adds ~20-30% to data-layer line items.
- "1 hour for Auth" is true on the happy path; first-time issues (env vars, redirect URLs, RLS policies for `auth.uid()`, cookie-vs-token confusion) typically add 2-3h.
- UI polish is systematically underestimated. The dashboard alone has multiple edge cases — empty state, single-review state, broken-streak state, sparse-heatmap state — each takes time to render correctly.
- After-hours work is lower productivity than dedicated work (interruptions, mental fatigue, life events).
- Hofstadter's law: software projects exceed their estimates 60-70% of the time, even after the maker corrects for it.

**Hour breakdown used to derive the LLM's p50:**

| Area | Hours |
|---|---|
| Base setup (Supabase project, Next.js app, Auth, routing/middleware) | 4-6 |
| Data layer (schema + RLS on 3 user-owned tables) | 2-4 |
| Notes CRUD (create form, list, view with highlighting, edit, delete) | 8-10 |
| Recall prompts CRUD (form, list, edit, delete) | 5-7 |
| Review loop (due query, review UI, ts-fsrs reschedule, review_events log) | 7-10 |
| Dashboard (due count, streak counter, heatmap) | 6-8 |
| Account delete + sign-out | 2-3 |
| Polish: error / loading / empty states, mobile responsive, bug-fixing | 12-20 |
| Deployment (Vercel + env vars) | 1 |
| **Total focused-work hours** | **47-69** |

At 10-15 hours/week of after-hours capacity → 3.1-6.9 calendar weeks. p50 ≈ 5 weeks.

**Resolution date:** the day the MVP ships (sign-up → create note → review prompt → streak + heatmap visible, all functional in production). Update this table with actual elapsed time on that date.

## Forward: tech-stack (informational — not part of PRD)

Decisions captured here are for the downstream `/10x-tech-stack-selector` step, not for `/10x-prd`. They get folded into `tech-stack.md`, not into PRD frontmatter or sections.

- Multi-user web app + companion CLI tool (CLI deferred to v1.1). Two surfaces, one backend.
- BYOK provider: OpenRouter (via PKCE OAuth). OpenRouter itself is a meta-provider so users can route to OpenAI / Anthropic / Gemini / open-source models using their existing accounts. (Required by v1.1 AI code-check; v1 ships without OpenRouter integration.)
- LLM calls server-side using the user's scoped OpenRouter token. Token storage is encrypted at rest; revocation is handled at OpenRouter's side.
- Backend lean: **Supabase** (Postgres + Auth + RLS). Supabase Auth covers email+password out of the box; RLS gives per-user data isolation at the DB layer.
- Verify OpenRouter PKCE OAuth docs at implementation time — API surface shifts occasionally.
