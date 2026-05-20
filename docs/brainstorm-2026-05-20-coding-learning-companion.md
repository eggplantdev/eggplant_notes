# Coding Learning Companion — Brainstorming Notes
Date: 2026-05-20

> Working title only. "Flashcard app" was the original framing; the product is broader. Final name TBD.

## Problem

Coding notes accumulate across projects, languages, and environments — scattered, write-once, rarely revisited. The pain has four parts:

- **Scattered** — notes live in random repos, Obsidian vaults, scratch files, README footers. No single place.
- **Write-once** — once written, almost never reread. The knowledge decays.
- **No reminder loop** — nothing nudges me to revisit a topic before I forget it.
- **No active recall + verification** — even when I do reread, it's passive. I can't tell if I'd actually be able to *write* the code again. There's no feedback signal.

I want one place for coding notes, scheduled reminders to revisit them (Anki-style), and the ability to write code inside a note that an AI agent grades.

## Existing Alternatives (and why they fall short)

| Tool | Notes (rich + code) | SRS reminders | AI code-check | Gap |
|------|---------------------|---------------|---------------|-----|
| Obsidian / Logseq | Yes | No (plugins are basic) | No | Knowledge base, no recall layer, no code verification |
| Notion | Limited code support | No | No | Not dev-focused |
| Anki | No — cards only, no notes layer | Yes | No | Recall-only, weak code rendering, no notes-driven model |
| RemNote | Yes | Yes | No | Closest fit; overly complex; no AI code grading |
| LeetCode / Exercism | No | No | Yes (test runner, not LLM) | Exercises only, not driven by your own notes |

None deliver the combination: **your own coding notes + scheduled reminders to revisit them + AI verification of code written inside the note.**

## Core Insight

Three-layer system:

1. **Notes** — primary entity. Markdown + code blocks with syntax highlighting. Tagged by language/topic. One canonical home for everything I'd otherwise scatter across projects.
2. **Recall prompts** — small structured nudges *attached to a note*: 1–2 examples + 1–2 questions per prompt. SRS-scheduled. Self-rated Again / Hard / Good / Easy on each review. The algorithm reminds me to re-engage with the *topic*, not just review a card in isolation.
3. **Code checks** — inside a note (or inside a recall prompt), an interactive editor block. I write the answer; an AI agent verifies it against the expected behavior. Active recall, with a feedback signal, not passive re-reading.

> "Flashcard" is the wrong word for layer 2 — it implies isolated cards. These are **topic recall prompts** bound to a note. Naming open.

## Decided Scope (v1)

- Web app
- **Notes** as primary entity — markdown editor, syntax highlighting, tags
- **Recall prompts** attached to notes — 1–2 examples + 1–2 questions per prompt, SRS-scheduled, self-rated Again/Hard/Good/Easy
- **AI code-check** inside notes — embeddable code editor block; agent grades user's code against expected behavior
- **Multi-user auth** (other developers can sign up). App-account auth method TBD (Phase 2).
- **BYOK via OpenRouter PKCE OAuth** — "Connect with OpenRouter" button; scoped key, billed to the user, revocable. $0 LLM cost for the operator. Trust problem dissolved into standard OAuth scope.
- REST API for programmatic note + prompt creation (so external Claude/Codex harnesses can write into it). Per-user API tokens for harness writes.
- **Companion CLI** — bidirectional: write notes/prompts, query existing notes, receive SRS reminders in the terminal.
- Streak + stats dashboard

## Out of Scope (v1) — Backlog

- In-app AI generation of notes/prompts (v1 uses external harness via REST API; v2 adds an in-app generator)
- Anki import / export
- Image attachments in notes
- **Local-first / offline support** — offline review on subway/plane is a real need. Options: PowerSync (sync over Supabase), ElectricSQL (Postgres → browser SQLite), or Dexie.js + manual sync. Significant complexity — revisit after v1 core is stable.

## AI Integrations

- **Code-check agent (v1, in-app)** — user writes code inside a note's code-check block, app sends the code + the expected-behavior spec to an LLM, LLM returns pass/fail + feedback. Provider: OpenRouter (existing in `workspace/ai_devs`).
- **External generation (v1, out-of-app)** — Claude Code / Codex skills already produce notes and recall material. Those harnesses call the REST API to create notes + recall prompts directly. No AI button in the app UI for v1.
  - **Replaces existing Anki-skill workflow.** Today the `anki` Claude Code skill extracts cards from a conversation and writes them to a local Anki desktop instance via AnkiConnect. v1 of this app must accept the same payload shape from the same trigger point — the only change for the user is endpoint URL (web app, not localhost AnkiConnect). Without this, the existing habit breaks.
  - Endpoint must accept a single request that creates a note + one or more attached recall prompts in one call (matches how the harness extracts both from one conversation). Separate `POST /notes` and `POST /prompts` endpoints are also fine for finer control.
- **In-app generation (v2)** — paste lesson material → AI produces a note + linked recall prompts.

## SRS Algorithm

- **SM-2** (1987, public, simple): `next_interval = last_interval × ease_factor`; ease factor adjusts on each self-rating.
- **FSRS** (Anki's current default since 2023, more accurate): `ts-fsrs` npm package makes integration nearly free.

Either is implementable in an afternoon. Decision pending.

## Gamification

Duolingo / Boot.dev style motivation layer.

**Streaks** — daily review streak counter. Maintained by hitting the daily goal. Reset on missed day.

**Goals (v1 — simple):**
- Prompts reviewed per day (e.g. "review 20 prompts") ✓
- New prompts learned per day (e.g. "learn 5 new prompts") ✓
- User configures their own target per goal type

**Goals (backlog):**
- Time spent — harder to implement (requires session tracking), defer to v2
- Notes written per week — promotes the knowledge-base habit, not just review

**Monthly goals** — aggregate of daily goals. e.g. "review 400 prompts this month."

Data needed: review events log (`prompt_id`, `user_id`, `timestamp`, `rating`) — feeds SRS + goals + stats. No extra storage cost.

## Stats & Visualizations

Single dashboard. Visual style: GitHub contribution heatmap + MonkeyType / Boot.dev clean-data feel — data-dense, not gamey.

- Activity heatmap — calendar grid of review intensity per day (the main visual)
- Streak counter + daily goal progress
- Prompts reviewed / new prompts learned over time
- Total prompts vs. mastered
- Notes-per-tag breakdown (knowledge-base coverage by language/topic)

Data source: review events log (shared with SRS + goals).

## Open Questions

### Carried over
- [ ] SM-2 vs FSRS — which to implement?
- [ ] Markdown editor for notes — rich editor (TipTap) or plain markdown + live preview?
- [ ] App-account auth method — email+password, magic link, Google/GitHub OAuth, or "sign in with OpenRouter" if it acts as identity? (Phase 2 of shape)
- [ ] Tag organization — flat tags, hierarchical (`js/react/hooks`), or decks?
- [ ] REST API auth for external tools (Claude skill) — per-user bearer tokens, generated in settings?

### New (from reframe)
- [ ] Naming — "recall prompt", "review prompt", "topic check", something else?
- [ ] Recall prompts: always attached to a note, or can they exist standalone (quick "do you remember X?" with no note backing it)?
- [ ] Code-check execution — does the LLM judge from spec alone, or do we actually run the code (sandboxed) and feed the run results to the LLM?
- [ ] Code-check supported languages — start with JS/TS only, or open from day one?
- [ ] Note ↔ prompt cardinality — one note → many prompts (clean default), or also allow many-to-many for shared concepts?
- [ ] REST API shape — single `POST /imports` that creates a note + N attached prompts in one call (mirrors the Anki-skill payload), separate `POST /notes` + `POST /prompts`, or both?
