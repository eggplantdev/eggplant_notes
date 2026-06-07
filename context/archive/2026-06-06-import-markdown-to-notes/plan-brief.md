# AI-Assisted Authoring (import + generate notes & cards) — Plan Brief

> Full plan: `context/changes/import-markdown-to-notes/plan.md`
> Scope reshape + decisions: `context/changes/import-markdown-to-notes/change.md`

## What & Why

Five authoring capabilities so a user isn't limited to manual note/card entry: deterministically
import structured markdown, AI-decompose an unstructured doc into many notes, write a note or a card
on a topic, and generate recall cards from a note. AI is opt-in behind the user's own OpenRouter
account (BYOK). Started as "import markdown → notes"; broadened into AI-assisted authoring during
planning (import is one of five surfaces — change-id kept stable).

## Starting Point

Notes, subjects, and memory-cards all have full CRUD. A card's "answer" is already the `example`
field (the `review-panel.tsx` "Show answer" disclosure). `create_note_with_checks` is an atomic
multi-row insert precedent; `generate-section-seed.mjs` has a fence-aware (H1-only) heading split.
`user_settings` is the per-user-setting + FK-cascade-cleanup precedent. No file upload, no
encryption-at-rest, no OpenRouter wiring exist yet.

## Desired End State

A signed-in user imports a `.md`/pasted text into many notes under a subject; connects OpenRouter
once; then asks AI to decompose a document into notes, write a note on a topic, generate cards from a
note, or write a stand-alone card on a topic — each output edited at a preview before commit.
Disconnecting or deleting the account removes the stored key.

## Key Decisions Made

| Decision            | Choice                                                                | Why                                                             | Source          |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- | --------------- |
| AI vs deterministic | Two AI primitives (gen-notes, gen-cards) + one deterministic split    | Structure is deterministic for clean md; meaning needs an LLM   | Frame/change.md |
| AI gate             | OpenRouter BYOK via OAuth PKCE                                        | Locked in shape-notes (×4)                                      | Frame           |
| Key at rest         | AES-256-GCM, server-only env key, RLS+FK-cascade table                | Real encryption-at-rest; PKCE was the only settled part         | Plan            |
| Card answer         | `example` column (no new `answer` col)                                | It's what "Show answer" already reveals; zero recall-loop churn | Plan            |
| Split UX            | H-level picker (H1/H2/H3) + editable/skippable preview                | Don't guess the boundary — let the user pick                    | Frame/Plan      |
| AI note-gen         | Multi-note decomposition (single-note is pointless → just add a note) | Value is splitting one source into many                         | Plan            |
| Grounded/ungrounded | Both primitives work from a source OR a topic                         | The 5 capabilities map onto this 2×2 + split                    | Plan            |
| Model selection     | Curated ~5–8 list + default + per-user override                       | "Curate don't enumerate" (same as S-13 Shiki langs)             | Plan            |
| Idempotency         | Preview-gated, always-insert, size cap                                | Preview is the dedup guard; no hashing complexity               | Plan            |
| Read sources (P1)   | File upload (`FileReader`) + paste; **PDF/image/audio future**        | In change.md's read-stage scope                                 | Frame/Plan      |

## Scope

**In scope:** deterministic md import; AI note-decomposition from prose; AI note from a topic; AI
cards from a note; AI stand-alone card from a topic; OpenRouter PKCE connect + encrypted key storage

- curated model choice.

**Out of scope:** PDF/image/audio reads; a `memory_cards.answer` column; service-role client /
Supabase Vault; re-import dedup/merge; live `/models` fetch; chat/conversational AI; caching (S-11);
recall-loop or RLS changes.

## Architecture / Approach

Two AI primitives × a grounded/ungrounded axis, plus one deterministic op:

```
                 Grounded (from source)        Ungrounded (from a topic)
 gen-notes   #3 doc/prose → N notes         #5 topic → 1 note
 gen-cards   #1 note → cards (link note_id)  #2 topic → 1 standalone card
 split       #4 structured md → N notes      —
```

All AI ops share one OpenRouter connect. Each AI op = a single-shot Server Action → one
`generateObject` (Zod schema) → the existing preview/edit gate → existing insert paths. `#3` and `#4`
are two read-strategies of one importer, sharing the preview/commit/subject pipeline.

## Phases at a Glance

| Phase                   | What it delivers                                 | Key risk                              |
| ----------------------- | ------------------------------------------------ | ------------------------------------- |
| 1. Deterministic import | `.md`/paste → N notes under a subject (no AI)    | Fence-aware level-split correctness   |
| 2. OpenRouter connect   | PKCE flow + AES-GCM key storage + curated models | OAuth contract drift; secret handling |
| 3. gen-cards (#1+#2)    | Cards from a note / from a topic                 | Ungrounded hallucination (#2)         |
| 4. gen-notes (#3+#5)    | Decompose doc / note from a topic                | Multi-note quality; ungrounded (#5)   |

**Prerequisites:** S-01/S-02/S-06 (done); F-01/F-02 RLS (done). New deps
`@openrouter/ai-sdk-provider` + `ai`; new env secret `OPENROUTER_ENC_KEY`.
**Estimated effort:** ~4 sessions (one per phase), each its own review→simplify→test→archive gate.

## Open Risks & Assumptions

- OpenRouter PKCE contract live-confirmed today; re-verify at Phase-2 implement time (no documented
  key expiry / rate limits found).
- AI SDK version split (`generateObject` vs v6 `Output.object`) — pin and confirm before coding.
- Live OAuth round-trip isn't fully E2E-able locally → Phase-2 leans on manual verification.
- Ungrounded generation (#2, #5) is the quality-weakest path; the preview/edit gate is the backstop.

## Success Criteria (Summary)

- A structured `.md` and pasted text both import into correct multi-note sets under a chosen subject.
- A user connects OpenRouter once; the key is stored only as ciphertext and removed on disconnect/delete.
- Each of the five capabilities produces an editable preview that commits to correctly-linked notes/cards.

---

## Iteration 2 (2026-06-07) — Phases 6–8

> Design source: `iteration-2-braindump.md` (all forks resolved). Builds on the now-green Phase 5 stream.

### What & Why

The AI half shipped, but three gaps remain: the model picker is a static 6-item `<Select>` (every user
silently on one model, no pricing, no choice at scale), the prompt is view-only (can't refine it), and
the import page is "super confusing" (operator) — plus PDFs can't be imported at all.

### Key Decisions Made

| Decision             | Choice                                             | Why (1 sentence)                                                             | Source |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Model source         | Live `/models` fetch (cached), searchable combobox | Public + free + carries pricing; combobox makes 300+ models usable           | Plan   |
| Model list UX        | Pinned "Recommended" group + full searchable list  | Zero-search happy path, full catalog when needed                             | Plan   |
| Extraction/gen split | None — per-generate override is the quality lever  | The override already lets you switch models on bad output; no slots needed   | Plan   |
| Prompt editing       | Full `{system, prompt}` editable                   | Operator is actively refining prompts; schema + preview gate are safety net  | Plan   |
| Dialog scope         | Shape A — dialog generates, host view commits      | Modal fits configure-and-fire; multi-item review needs page width            | Plan   |
| Import scope         | Notes-only, grounded-only; UX restructure          | "Organize text" already works (#3) — the gap was presentation, not feature   | Plan   |
| PDF                  | In, via multimodal vision (single call → notes)    | Operator wants it; ref repo did it; reopens S01E04 (scope-led, not date-led) | Plan   |

### Phases at a Glance

| Phase                                  | What it delivers                                           | Key risk                                                |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 6. Live model catalog                  | Cached `/models` + searchable combobox w/ pricing + filter | Cache strategy; validating ids against live list        |
| 7. Unified editable dialog + import UX | Wider dialog, editable prompt, topic-in-dialog, import fix | Touches dialog + both forms + import panel at once      |
| 8. PDF via vision                      | PDF upload → vision `generateObject` → notes               | AI SDK v6 file-part contract; scanned-PDF failure modes |

**Prerequisites:** operator commits the green Phase-5 stream as a checkpoint before Phase 6.
**Estimated effort:** ~3 sessions (one per phase), each through the review→simplify→test→archive gate.

### Open Risks & Assumptions

- AI SDK v6 file-part contract verified at `ai@6.0.0-beta.128` (pre-GA) — re-verify at v6 stable.
- Phase-7 "import confusion" fix assumes the operator's unfinished "why" = the auto-split "Preview — 1
  note" on headingless paste; revisit if they meant otherwise.
- Scanned PDFs (no text layer) are out — vision handles layout but OCR-grade scans may degrade.
