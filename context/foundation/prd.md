---
project: "Coding Learning Companion"
version: 1
status: draft
created: 2026-05-20
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-06-10
  after_hours_only: true
---

# Coding Learning Companion — Product Requirements (v1)

> Working title only. Final name TBD — see Open Questions.

## Vision & Problem Statement

Developers accumulate coding notes across many projects, languages, and environments — scattered, write-once, rarely revisited. Notes live in random repository READMEs, personal knowledge-base apps, and scratch files. There's no reminder to come back, no signal for what's retained vs forgotten, and no way to actively verify a concept by writing code that something will grade. Existing tools force a trade: knowledge-base products lack a recall layer; spaced-repetition products render code poorly and have no notes layer; products that combine the two treat AI as a bolt-on generator. Knowledge decays silently while the developer rewrites notes they already had.

Many developers spend their working day inside terminal-based coding agents already. The insight: instead of bolting AI onto a notes app, make agent integration a first-class interface that runs alongside a conventional web UI. Notes and recall prompts can be created from the terminal (for agent-native users) or via in-app forms (for everyone else). Code answers inside notes get verified by an AI agent in-app. Reminders and queries can also be issued from the terminal so the recall loop runs in the workflow the user already uses. The cost model is bring-your-own-key — each user authorizes the app to make LLM calls against their own external account, so calls are billed to them and revocable; the operator carries no LLM cost and the trust problem dissolves into a standard authorization scope.

## User & Persona

### Primary persona — developer managing personal coding-learning notes

Audience: developers — any language, any stack, employed or independent — who write coding notes across many projects and want a centralized personal knowledge base with active recall and AI code verification. This is a *personal* tool: even a team-employed developer uses it for their own learning, not to share decks with teammates. Two subtypes are both in v1 scope:

- **Agent-native subtype** — lives in the terminal with coding-agent tools. Prefers a command-line interface for note creation, querying, and receiving recall reminders.
- **Non-agent subtype** — prefers the in-app web UI for everything: manual note creation, manual review, visual dashboard.

The reach moment: the developer spent hours learning a concept, wrote notes somewhere, and is about to forget it because nothing reminds them. They want the system to handle recall scheduling, surface reminders in the surface they already use (terminal or web), and actively verify code answers via AI.

**Pain dimensions (all four apply):**
- Workflow friction — gathering + revisiting notes scattered across tools
- Missing capability — no existing tool combines notes + recall scheduling + AI code verification
- Data trapped — notes locked in repositories, knowledge-base apps, scratch files; no central query
- Forgetting / decay — no retention signal; knowledge lost without warning

## Success Criteria

### Primary

- A new user can complete the end-to-end recall loop in two sessions without errors: sign up → sign in → create a note with code rendered with syntax highlighting → attach a recall prompt → return after the scheduled interval → complete the review with a self-rating → see the next interval reschedule.
- After the first review, the user's dashboard reflects their activity: heatmap shows the day, streak counter reads 1.

### Secondary

- A user sustains use for ≥ 7 days, with a non-trivial streak (5+ review sessions). Indicates the loop is actually engaging, not just functional.
- A second user (someone other than the operator) signs up and uses the product without intervention.

### Guardrails

- Per-user data isolation enforced at the persistence layer: no user ever sees another user's data, even with an application-layer bug.
- Notes and recall prompts persist reliably; nothing silently dropped.
- Due reviews always surface on the dashboard at the scheduled time — the reminder loop never misses a prompt.
- Auth flows (sign-up, sign-in, password reset) all functional. Broken auth blocks all value.
- Markdown code-block rendering preserves syntax highlighting on the languages most relevant to the audience (JavaScript / TypeScript at minimum; Python, Go, Rust as bonus). A note that renders code as plain text fails the product premise.

## User Stories

### US-01: User creates and reviews a recall prompt

- **Given** a signed-in user with no existing notes
- **When** they create a note with a markdown body containing a code block, attach a recall prompt with a question, and return after the prompt's scheduled due date
- **Then** the dashboard shows "1 prompt due", they can complete the review with a self-rating, and the prompt is rescheduled based on the recall-scheduling algorithm

#### Acceptance Criteria
- Note's code block renders with syntax highlighting (not plain text)
- Recall prompt persists across sessions
- Due prompts surface on the dashboard exactly when scheduled
- Rating the prompt updates the recall schedule and records a review event
- Heatmap reflects the review day with appropriate intensity color
- Streak counter increments to 1 after the first review

## Functional Requirements

### Authentication
- FR-001: User can sign up with email + password. Priority: must-have
- FR-002: System sends a verification email at sign-up; the user is NOT required to verify before accessing the app in v1. Priority: must-have
  > Socrates: Counter-argument considered: "gated verification adds onboarding friction without clear v1 benefit for a personal-tool product." Resolution: keep the email send (the chosen auth layer's default behavior — zero extra cost) but defer the verification gate to v1.1. Saves the "unverified state" UX and confirmation-link redirect handling in v1.
- FR-003: User can sign in with email + password. Priority: must-have
- FR-004: User can reset their password via email link. Priority: must-have
- FR-005: User can sign out. Priority: must-have
- FR-006: User can delete their account from settings; deletion removes all owned data (notes, prompts, review events, and any connected external-LLM credential). Priority: must-have
  > Socrates: Counter-argument considered: "self-service deletion is meaningful overhead; deletion requests could be handled manually via email until you have real users." Resolution: kept; self-service deletion is a baseline trust requirement, and the full-ownership-delete behavior is required by data-isolation guarantees anyway — only the UI overhead is saved by deferring.

### Notes
- FR-007: User can create a note with a title and markdown body. Priority: must-have
- FR-008: User can view a note rendered with markdown formatting and code-block syntax highlighting. Priority: must-have
- FR-009: User can edit a note's title and body. Priority: must-have
- FR-010: User can delete a note; attached recall prompts are removed along with it. Priority: must-have
- FR-011: User can see a list of all their notes. Priority: must-have

### Recall prompts
- FR-012: User can attach a recall prompt to a note (question + optional example + optional code-block context). Priority: must-have
- FR-013: User can edit a recall prompt. Priority: must-have
- FR-014: User can delete a recall prompt. Priority: must-have
- FR-015: User can see all prompts attached to a given note. Priority: must-have

### Review loop
- FR-016: System surfaces prompts due for review on the user's dashboard. Priority: must-have
- FR-017: User can review a due prompt and self-rate Again / Hard / Good / Easy. Priority: must-have
- FR-018: System reschedules each prompt's next due date using an adaptive recall-scheduling algorithm informed by the user's rating. Priority: must-have
  > Socrates: Counter-argument considered: "an adaptive recall-scheduling algorithm adds complexity vs hardcoded intervals (e.g. Again→1d, Hard→3d, Good→1w, Easy→1m)." Resolution: use an established modern adaptive algorithm — established implementations integrate trivially and offer no meaningful complexity overhead vs hardcoded intervals.
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
- The dashboard renders usably on viewport widths down to ~360px (mobile). The heatmap may compress; everything else stays usable. Mobile review (checking due-count on the go) is a real use case.
- The review flow (open prompt → see question → rate → see next state) feels responsive — the user perceives the rating action as instant; no multi-second wait between submitting a rating and seeing the next prompt or the "no more due" state.
- Auth flows (sign-up, sign-in, password reset) complete within human-perception timing — no multi-second delays under normal load.
- The user's recall data (notes, prompts, review events, and any connected external-LLM credential) survives normal browser closures and app updates without loss.

## Business Logic

The system schedules each recall prompt's next review date by adapting to the user's self-rated recall performance — making review intervals longer after successful recalls and shorter after failures.

Inputs the rule consumes (as user-facing inputs): the user's self-rating (Again / Hard / Good / Easy) after each review, plus the prompt's review history (timestamps and prior ratings). Output: the date the prompt next appears in the user's due-list. The user encounters this every time the dashboard shows "X prompts due" — that count is entirely driven by the algorithm's scheduling decisions. A failed review reschedules the prompt sooner; a successful one reschedules it later. The system effectively learns each user's pacing per prompt.

This is the domain decision that makes the app non-trivial. Without it, the app degenerates into a tagged-notes list. The rule is the product.

## Access Control

Multi-user. Every user owns their own notes, recall prompts, review history, and any connected external-LLM credential; no data is shared between users. One role (regular user) — flat model.

**Sign-up / sign-in (v1):** email + password. The auth layer handles password hashing, password reset, and email delivery. A verification email is sent at sign-up by default, but app access is NOT gated on verification status in v1 (see FR-002 resolution); the verification gate is deferred to v1.1.

**Connected services (separate from app auth):** the user can connect an external LLM-credential service after sign-in, as a one-click "Connect" step in settings. Two states: connected (in-app AI features work — when those features ship in v1.1) or disconnected (in-app AI features are gated behind a "Connect to use" prompt; everything else — notes, recall prompts, manual review, stats — works without it).

**External programmatic-write surface (v1.1, not in MVP):** authenticated per-user via a token the user generates in settings. Used by external coding-agent tools and a companion command-line client. Scope: same data as the user's web session; no cross-user access. Design intent captured here so isolation policies don't need refactoring when this surface ships.

**Unauthenticated request handling:** any gated route (notes, prompts, dashboard, settings) returns an unauthorized response / redirects to sign-in. Public surface: sign-in, sign-up, password reset, marketing landing (if any).

**Per-user data isolation:** enforced at the persistence layer — so an application-layer bug cannot expose another user's data. Application code does not become the boundary.

**Account deletion:** user can delete their account from settings; the deletion removes all of their notes, prompts, review events, and any connected external-LLM credential.

## Non-Goals

v1 explicitly does NOT include the following.

- **Import or export from external spaced-repetition products.** Adopting an external format creates a maintenance burden against a third-party format that doesn't fit this product's note-first three-layer design. May reconsider in v2 if there's real user pull.
- **Team workspaces / shared decks / collaborative notes.** Explicit personal-tool lock for all versions. Each user's data is fully theirs; there is no concept of teams, sharing, or collaboration in any planned version.
- **Local-first / offline support.** v1 is online-only. Offline review (subway, plane) is a real use case that's deferred to maybe v2 if user demand justifies the complexity.
- **Native mobile app.** Web-only product. The web app must be mobile-responsive (per NFR), but no native binary or app-store distribution work in any planned version.

Items already deferred to v1.1 (in-app AI code-check, external-LLM credential integration, companion command-line client, programmatic write surface for external coding-agent tools, push or email reminders, tag organization, email verification gate) are out-of-MVP rather than out-of-product, and are not duplicated here.

## Open Questions

1. **What is the final product name?** "Coding Learning Companion" is the working title. Owner: user. By: before v1 launch.
2. **What user-facing label does the layer-2 concept ("recall prompt") read as in the UI?** Candidates surfaced during shaping include "recall prompt," "review prompt," "topic check." Affects all user-facing copy and onboarding clarity. Owner: user. By: v1 implementation start.
3. **What rich-text editing affordances does the note editor offer in v1?** Plain markdown with live preview, or a richer editor with toolbar buttons? Affects the Notes-CRUD line-item estimate and the perceived polish of the editor surface. Owner: user. By: v1 implementation start (Notes CRUD step).
4. **`target_scale.qps` and `target_scale.data_volume`** were not explicitly captured during shaping. For a `users: small` (single-digit to handful) product, `qps: low` and `data_volume: small` are the natural inferences — both populated in the frontmatter on that basis. Confirm or override before downstream stack selection. Owner: user. By: before `/10x-tech-stack-selector`.
