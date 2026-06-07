---
change_id: import-markdown-to-notes
title: Import a markdown file into notes — deterministic heading-split + preview, optional AI card generation
status: implementing
created: 2026-06-06
updated: 2026-06-07
archived_at: null
---

## Scope reshape — AI-assisted authoring (2026-06-07, planning session)

**The change-id understates the real scope.** What started as "import markdown → notes"
broadened during `/10x-plan` into an **AI-assisted authoring** slice. Import is one of five
surfaces. Change-id kept stable (`import-markdown-to-notes`) to avoid folder/Linear churn, but
the true scope is the five capabilities below. The roadmap S-19 row carries a scope-flag note.

### The five success criteria (operator-stated)

1. **Generate card(s) from an existing note** — AI reads a saved note's prose → recall cards.
2. **Generate a stand-alone card on any topic** — AI from a topic string, no source note.
3. **Import a document / paste text → AI generates notes from it** — decompose unstructured
   prose into **multiple** notes (single-note output is pointless — just create a note).
4. **Import structured markdown → notes deterministically** — heading-split, **no AI**.
5. **Generate a note on any topic** — AI from a topic string, single note.

### Two AI primitives × a grounded/ungrounded axis (+ one deterministic op)

| Primitive                                  | Grounded (from source text)                | Ungrounded (from a topic)        |
| ------------------------------------------ | ------------------------------------------ | -------------------------------- |
| **gen-notes** `{notes:[{title,content}]}`  | **#3** doc/prose → **N** notes (decompose) | **#5** topic → **1** note        |
| **gen-cards** `{cards:[{prompt,example}]}` | **#1** note → cards (link `note_id`)       | **#2** topic → 1 standalone card |
| **split** (deterministic, no AI)           | **#4** structured md → N notes             | —                                |

`#5` is gen-notes in single/ungrounded mode (same call+schema as `#3`); `#1`↔`#2` is the same
grounded/ungrounded axis. Ungrounded ops (`#2`,`#5`) carry the highest hallucination risk →
grounding discipline (S01E01) + the preview/edit gate are the safety nets.

### Entry surfaces

- **Import surface** → `#4` (deterministic split) + `#3` (AI decompose) — the two read-strategies
  of one importer, sharing the preview/commit/subject pipeline.
- **New-note flow** → `#5` ("generate a note on a topic" mode).
- **Note page / card section** → `#1` ("generate cards from this note").
- **Standalone card form** → `#2` ("generate a card on a topic" mode).

### OVERRIDE of the read-stage boundary below (operator, 2026-06-07)

The "Read-stage source types — SCOPE BOUNDARY" section below (2026-06-06) parked **all**
AI-prose-reading as FUTURE and kept markdown deterministic-only. **That is now overridden:**
AI note-extraction-from-prose (`#3`) and AI generation (`#1`,`#2`,`#5`) are **IN** S-19.
Still out: **PDF / image / audio** read sources (those remain a future, separate slice). The
determinism principle is preserved where it applies — **structured markdown still uses the
deterministic split, no LLM call**; AI is the path for _unstructured_ input and topic-prompted
generation only.

### Resolved solution-design decisions (planning session, 2026-06-07)

- **OpenRouter key at rest** — **AES-256-GCM** (Node `crypto`), server-only key from `env.ts`;
  ciphertext in a new RLS + FK-cascade-to-`auth.users` table; decrypt server-side per request.
  The PKCE connect _is_ the "login gate" (locked in shape-notes); at-rest storage was the only
  open sub-decision.
- **Split UX** — heading-level picker (H1/H2/H3) + editable/skippable per-note preview.
- **Card model** — AI writes `{prompt, example}`; **`example` IS the answer** (that's what the
  `review-panel.tsx` "Show answer" disclosure reveals today — no `answer` column needed, no
  recall-loop churn). Grounded cards link `note_id`; standalone (`#2`) set `note_id` null.
- **Subject on import** — pick existing (combobox) OR new-subject field (default filename/H1);
  notes appended via fractional `position`.
- **Read sources (Phase 1)** — file upload (`.md`/`.markdown`/`.txt` via `FileReader`, no bucket)
  - paste textarea; both feed the same split→preview pipeline.
- **Model selection** — curated short list (~5–8 cheap+good-for-extraction), sane default,
  per-user override persisted on the credential row; NOT a live `/models` fetch (same call as S-13).
- **Idempotency** — preview-gated, always-insert (the preview IS the dedup guard); size cap
  (reject oversized files / too many sections) with a clear message. No hashing/merge.
- **Phase gate** — each phase ships through its own review→simplify→test→archive gate.

### Plan phases (4)

1. **Deterministic import** (`#4`) — split + bulk RPC + upload/paste UI + preview + subject picker. No AI/creds.
2. **OpenRouter connect** (shared gate) — PKCE flow + AES-GCM storage + server client + curated models + `/settings` connect.
3. **gen-cards** (`#1`+`#2`) — card primitive: grounded on a note, ungrounded from a topic.
4. **gen-notes** (`#3`+`#5`) — note primitive: grounded multi-note decompose, ungrounded single-note.

Full detail → `plan.md`; two-pager → `plan-brief.md`.

## Notes

**Parked — post-ship.** This is an _extra_ surface, explicitly NOT deadline (2026-06-10) work.
Capture it as a slice now; pick it up only after the basic version ships. Do not implement
ahead of the in-flight `list-search-pagination` and `seed-sample-data` work.

### Problem

Today the only way to create a note is manual entry — far from great. Users with an existing
markdown corpus (the operator's own `/workspace/learning` notes are the motivating case) should
be able to import a markdown file and get notes (note-sections under a subject), ideally with
recall cards too.

### Why the existing seed script does NOT generalize

`supabase/seed-scripts/generate-section-seed.mjs` is a DEV-ONLY transcoder, not an importer. It
only works on the operator's corpus because of three hard-coded contracts:

1. **Split boundary = H1** (`parseNoteSections`, splits on `^#\s`, fence-aware). One `#` → one note.
2. **Cards come from a separate parallel file** in a rigid `## group / Q: / A:` format
   (`parseCards`). It does **not** generate cards from prose — it reads pre-authored flashcards.
3. **Matcher tuned to the operator's bilingual PL/EN vocab** — hard-coded Polish stopwords +
   synonym map (`niemutowalnosc → immutability`).

### Feasibility — two problems with opposite answers (the core insight)

- **A. Structural split (markdown → sections):** _deterministic and reliable_ — markdown headings
  are unambiguous, fence-aware parsing already solved. The only ambiguity is **which heading level
  is a "note"** across inconsistent docs (some use `#` for title + `##` for sections; some nest
  `###`; some have no headings). Fix: **don't guess — let the user pick the split level + show a
  preview.** Determinism preserved; ambiguity handed to a human decision.
- **B. Card generation from prose:** _not deterministic and cannot be made so._ Arbitrary prose has
  no Q/A; producing recall cards requires understanding the text → an LLM → inherently
  non-deterministic. The seed script sidesteps this by consuming hand-authored cards.

### Chosen approach (the standard import pipeline — CSV-importer pattern)

```
deterministic split (user picks H-level)  →  PREVIEW / EDIT  →  optional AI card-gen (preview-gated)  →  commit
```

Determinism for structure, AI for meaning, **human-in-the-loop on both**. Nothing commits without
a human looking at it, so the non-deterministic step degrades to "edit before save," never "silent
garbage inserted under RLS." This is how Stripe/Notion/Airtable importers work: parse → map/preview
→ confirm → write.

### AI wiring decision (when built) — OpenRouter BYOK via OAuth PKCE

AI uses **the user's own OpenRouter account (BYOK)**, connected via an **OAuth PKCE flow** — NOT a
server-side Vercel AI Gateway key (an earlier suggestion, scrapped). This matches the product's
locked decision in `context/foundation/shape-notes.md` ("BYOK via OpenRouter PKCE") and `TODO.md`
Cluster 6.

**Bundled into this one slice** (operator decision 2026-06-06): S-19 ships the importer **and** the
OpenRouter connect **and** the AI generation — not a separate connect slice. Phase it internally so
the AI surface can't block the no-risk part:

- **Phase 1 — deterministic import (no AI, no credentials):** markdown → heading-split → preview/edit
  → commit. Delivers value alone.
- **Phase 2 — OpenRouter connect + AI generation:** the OAuth PKCE flow + encrypted per-user key
  storage + a server-side OpenRouter client, then the AI note/card generation that consumes it.

**Gating / opt-in UX (operator, 2026-06-06):** AI generation is **offered only to OpenRouter-connected
users** — on import (and likely a "create note/cards with AI" entry point), users are _asked_ whether
to generate with AI; the option is available only if they've connected OpenRouter, otherwise it
prompts them to connect (or they proceed deterministic-only). AI is never forced and never the default
path for a non-connected user.

**The three sub-problems of the connect (why Cluster 6 calls it the largest surface):**

1. **OAuth PKCE flow** — a "Connect OpenRouter" action → authorize on OpenRouter → scoped key via a
   PKCE callback route (code-verifier handling). New auth flow, new route handler under `src/app/api/`.
2. **Credential storage** — the key is a secret: encrypted at rest, per-user, RLS-scoped, **never**
   shipped to the client, decrypted server-side only when calling OpenRouter. Account-delete (S-05)
   must remove it (FR-006 already reserves "connected external-LLM credential").
3. **Server-side OpenRouter client** — calls models with the user's key; non-deterministic output →
   stays preview-gated (Phase-1 preview pattern reused).

### Resolved decisions (operator, 2026-06-06)

- **AI mechanism** — OpenRouter BYOK via **OAuth PKCE** (not Vercel Gateway, not plain key-paste).
- **Decomposition** — **bundled** into this one slice (importer + connect + AI gen), phased internally
  (Phase 1 deterministic, Phase 2 connect+AI).
- **AI is opt-in, gated to OpenRouter-connected users** — never forced, never default for non-connected.
- **Entry point = a button / toggle**, NOT a chat window. A scoped single-shot action ("Generate cards
  from this note" / a "Generate with AI" toggle in the import preview) → one **structured-output** LLM
  call (Zod schema via the AI SDK's `generateObject` / tool-use, returning `{notes, cards:[{prompt,
example}]}` already shaped) → the same preview/edit gate → commit. Chat was rejected as the entry
  point: it stacks conversation state + streaming on top of the SAME structured-extraction step
  (the real bottleneck) without removing it — more surface, scope-creep risk. A conversational "AI
  authoring" surface stays a separate **future** feature on the parking lot, not part of S-19.

### Reference implementations (ai_devs repo — `/Users/konradantonik/workspace/ai_devs`)

Two partial references; **neither is a turnkey "OpenRouter BYOK via PKCE"** — together they cover the
mechanics, but the OpenRouter-specific OAuth contract still needs live docs at plan time.

- **OpenRouter _client_ wiring** — `4th-devs/config.js` (lines ~18, 91, 141, 171, 285): baseURL
  `https://openrouter.ai/api/v1`, `OPENROUTER_API_KEY`, `EXTRA_API_HEADERS` for OpenRouter, model
  routing on the `provider/model` `/` convention. Covers Phase-2 sub-problem #3 (server-side client,
  headers, model routing). **CAVEAT:** uses a **static operator key from `.env`** — the plain-key
  model, NOT per-user OAuth PKCE. Good for _how to call_ OpenRouter, not _how the user connects_.
- **Generic PKCE OAuth flow** — `4th-devs/04_05_apps/mcp/src/shared/oauth/{flow,discovery,cimd}.ts` +
  `storage/interface.ts`: `oauth4webapi`-based, code-challenge/verifier, callback, a `TokenStore`
  interface. Strong _structural_ reference for PKCE mechanics (sub-problems #1 + #2). **CAVEAT:**
  generic MCP OAuth "from Spotify MCP" assuming standard OAuth discovery; OpenRouter's PKCE is its own
  simpler custom flow (`openrouter.ai/auth?callback_url=…&code_challenge=…` → exchange at
  `/api/v1/auth/keys`) — adapt, don't copy. Confirm the exact contract via OpenRouter live docs.

### Lesson references (ai_devs `zadania/episode-map.md` — the authoritative concept→theory→code index)

Use the episode-map first; it maps each concept to its theory file (`teoria/`) + runnable code example + the task that exercises it. Relevant lessons for this slice:

- **Structured generation** → **S01E01** (`teoria/s01e01-*`; code `01_01_structured`, `01_01_grounding`):
  `response_format`+`json_schema` (OpenAI/OpenRouter/Anthropic). Property order matters
  (reasoning→answer); include "unknown" values to cut hallucination. Our transforms = extraction +
  generation. (Repo uses raw `json_schema` via direct API, not AI SDK `generateObject` — either works.)
- **Token/prompt caching** → **S01E02** (§Speed) + **S02E01** (`teoria/s01e02-*`, `s02e01-*`; code
  `02_01_agentic_rag`): prompt cache = #1 cost/latency lever. Discipline: **static system prompt,
  dynamic data in user messages** (system-prompt change invalidates the tool cache). `prompt_cache_key`
  for repeated runs over the same large file; track `cached_tokens`.
- **Cost-optimal model selection** → **S01E01** (§Model Selection) + **S01E05** (§Cost) (`teoria/
s01e01-*`, `s01e05-*`; code `01_05_agent/src/config/models.ts`): "best for THIS task," **start cheap,
  escalate on failure**; curated `MODELS` registry w/ fallback. (Feeds the curated-model-list decision.)
- **Reading non-markdown sources** → **S01E04 Multimodality & Attachments** (the lesson) + **S02E02**
  (`teoria/s01e04-*`, `s02e02-*`; code `01_04_image_recognition`, `01_04_audio`, `01_04_reports`): feed
  PDFs/images/audio to a multimodal model to extract content (vision, transcription); the Media
  Reference Pattern; DeepSeek-OCR for rendered docs (9–10× compression @ 96%).
- **(bonus) KB-for-AI** → **S04E04** (`teoria/s04e04-*`): notes/cards as an agent-navigable knowledge base.

### Read-stage source types — SCOPE BOUNDARY (operator, 2026-06-06)

**S-19 initial scope = `markdown` + `pasted text` ONLY.** `PDF / image / audio` are **definitely NOT
now** — explicitly out of scope for the first plan; do NOT pull them into S-19's `/10x-plan`. They are
a **separate future expansion** (own slice when the time comes).

The design stays forward-compatible: model the importer's read stage as **pluggable** so adding sources
later is additive, not a rewrite — all paths converge on the SAME `read → preview → structured-generation
→ commit` pipeline:

- `markdown` → deterministic heading-split (Phase 1, no AI) — **in scope**
- `pasted text` → trivial — **in scope**
- `PDF / image` → multimodal extraction (S01E04 vision / DeepSeek-OCR) — **FUTURE, not S-19**
- `audio` → transcription (S01E04) — **FUTURE, not S-19**

Markdown stays deterministic + AI-free; the future non-markdown reads are AI-reads that would ride the
same OpenRouter Phase-2 plumbing if/when built.

### Open forks (for `/10x-plan`, do not resolve now)

- **Split-level UX** — picker (H1/H2/H3) + live preview of resulting notes; allow edit/merge/skip
  per section before commit.
- **Where the card "answer" lives** — `memory_cards` has **no answer column** (only `prompt`,
  `example`, `code_context`); the recall model assumes the answer is in the source note. AI-generated
  cards must decide where the answer goes (current seed convention: into `example`). Carries the open
  TODO Cluster 5 modeling question.
- **Subject assignment** — import into a new subject vs an existing one; note ordering = `position`.
- **File size / safety** — large-file handling, fence-aware split correctness, idempotency on re-import.
- **PKCE specifics** — confirm OpenRouter's current OAuth/PKCE contract (callback shape, key scoping,
  revocation) via live docs at plan time; don't code from memory.
- **Credential encryption-at-rest mechanism** — how/where the OpenRouter key is encrypted (Supabase
  Vault vs app-level crypto); must be RLS-scoped, server-only, removed on account-delete (S-05).
- **Model selection (Phase 2)** — OpenRouter is a multi-model gateway and BYOK bills the user's own
  key per model, so cost/quality is their call. Plan needs: a sensible **default model** (zero-config
  works) + a **model select** to override it (persisted per-user in `/settings` by the connect button;
  maybe a per-generation override in the preview step). **Model list source RESOLVED 2026-06-06:**
  a **curated short list** (~5–8 cheap+good-for-extraction models), NOT a live OpenRouter `/models`
  fetch — same "curate don't enumerate" call as S-13 (curated Shiki langs); avoids a 300+-model UI +
  extra request. Defer live `/models` only if a user needs an off-list model. Phase-2 only — no
  Phase-1 impact.

### Next step

`/10x-plan import-markdown-to-notes` when this comes off the parking lot — this is a **slice**, so plan
(NOT `/10x-shape`, which is the foundation-level whole-product tool). Net-new surface with real forks;
research OpenRouter's PKCE contract before/inside the plan. Roadmap row already added (S-19, band
post-deadline/v2).
