---
change_id: import-markdown-to-notes
title: Import a markdown file into notes — deterministic heading-split + preview, optional AI card generation
status: new
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

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
