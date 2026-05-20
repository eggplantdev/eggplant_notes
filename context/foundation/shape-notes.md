---
project: "Coding Learning Companion"
context_type: greenfield
created: 2026-05-20
updated: 2026-05-20
timeline_budget:
  mvp_weeks: 3
checkpoint:
  current_phase: 4
  phases_completed: [1, 2, 3]
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
  frs_drafted: 0
  quality_check_status: pending
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

## Access Control

Multi-user. Every user owns their own notes, recall prompts, review history, and connected OpenRouter token; no data is shared between users. One role (regular user) — flat model.

**Sign-up / sign-in (v1):** email + password. The chosen auth layer (Supabase Auth lean) handles password hashing, password reset, and email verification. Email verification is required at sign-up to prevent throwaway accounts.

**Connected services (separate from app auth):** OpenRouter PKCE OAuth happens *after* sign-in, as a one-click "Connect with OpenRouter" step in settings. Two states: connected (in-app AI features work) or disconnected (in-app AI features are gated behind a "Connect OpenRouter to use" prompt; everything else — notes, recall prompts, manual review, stats — works without it).

**External harness writes (REST API):** authenticated per-user via a token the user generates in settings. Used by Claude Code / Codex skills and the companion CLI. Scope: same data as the user's web session; no cross-user access.

**Unauthenticated request handling:** any gated route (notes, prompts, dashboard, settings, REST API) returns 401 / redirects to sign-in. Public surface: sign-in, sign-up, password reset, marketing landing (if any).

**Per-user data isolation:** enforced at the database layer via row-level security (RLS) — `auth.uid()` policies on every user-owned table, so even an application-layer bug can't expose another user's data. Application code does not become the boundary.

**Account deletion:** user can delete their account from settings; deletion cascades to all their notes, prompts, review events, and the connected OpenRouter token.

## Success Criteria

### Primary

- A new user can complete the end-to-end recall loop in two sessions without errors: sign up → verify email → sign in → create a note with code rendered with syntax highlighting → attach a recall prompt → return after the scheduled interval → complete the review with a self-rating → see the next interval reschedule.
- After the first review, the user's dashboard reflects their activity: heatmap shows the day, streak counter reads 1.

### Secondary

- A user sustains use for ≥ 7 days, with a non-trivial streak (5+ review sessions). Indicates the loop is actually engaging, not just functional.
- A second user (someone other than the operator) signs up and uses the product without intervention.

### Guardrails

- Per-user data isolation enforced at the database layer (RLS): no user ever sees another user's data, even with an application-layer bug.
- Notes and recall prompts persist reliably; nothing silently dropped.
- Due reviews always surface on the dashboard at the scheduled time — the reminder loop never misses a prompt.
- Auth flows (sign-up, sign-in, email verification, password reset) all functional. Broken auth blocks all value.
- Markdown code-block rendering preserves syntax highlighting on the languages most relevant to the audience (JS/TS at minimum; Python, Go, Rust as bonus). A note that renders code as plain text fails the product premise.

## Forward: v1.1 / v2 deferred scope (informational — not part of PRD)

Everything below is explicitly out of v1 MVP scope but tracked here so the next iteration has a clear queue:

- **v1.1 — close the gap to "real product":**
  - AI code-check inside notes (requires OpenRouter PKCE OAuth + server-side LLM calls)
  - Companion CLI (write, query, terminal reminders)
  - REST API for external harness writes (per-user bearer tokens)
  - Email daily-digest reminders OR web push notifications
  - Tag organization (flat tags first)
- **v2 — advanced:**
  - In-app AI generation of notes/prompts (paste lesson → notes + prompts produced)
  - Many-to-many note↔prompt
  - Daily / monthly / weekly goals with user-configured targets
  - Time-spent tracking
  - Anki import/export
  - Local-first / offline support

## Forward: tech-stack (informational — not part of PRD)

Decisions captured here are for the downstream `/10x-tech-stack-selector` step, not for `/10x-prd`. They get folded into `tech-stack.md`, not into PRD frontmatter or sections.

- Multi-user web app + companion CLI tool. Two surfaces, one backend.
- BYOK provider: OpenRouter (via PKCE OAuth). OpenRouter itself is a meta-provider so users can route to OpenAI / Anthropic / Gemini / open-source models using their existing accounts.
- LLM calls server-side using the user's scoped OpenRouter token. Token storage is encrypted at rest; revocation is handled at OpenRouter's side.
- Backend lean: **Supabase** (Postgres + Auth + RLS). Supabase Auth covers email+password out of the box; RLS gives per-user data isolation at the DB layer.
- Verify OpenRouter PKCE OAuth docs at implementation time — API surface shifts occasionally.
