# S-19 — Iteration-2 brain dump (2026-06-07)

**Status:** RAW capture for discussion. Not a design, not approved. Nothing here is committed scope.
**Folds into:** S-19 `import-markdown-to-notes`, branch `feat/ai-assisted-authoring` (PR #1).
**Builds on / amends:** `model-select-and-prompt-debug-design.md` (several items below revise it).

Operator dump, verbatim intent captured + my read + the open forks. We talk through these one at a
time; no implementation until a design lands and is approved.

**Constraint note (operator, 2026-06-07):** the 2026-06-10 deadline does NOT govern this iteration.
Original plan was 6 slices; the project is ~20 + features built outside the roadmap. This work is
scope-led, not date-led — do not hedge scope decisions against the deadline.

---

## 1. Split "analyze an imported doc → notes" from "generate from a topic"

**Ask:** the model/agent that _reads imported docs to extract notes_ (#3, grounded decompose) should
be a **separate** concern from the agent that _generates_ notes/standalone cards from a topic
(#2/#5, ungrounded). Today they are one path — change.md states "#5 is gen-notes in single/ungrounded
mode (**same call + schema as #3**)", differentiated only by prompt.

**My read / why it matters:**

- These are genuinely different jobs. Decompose = _extraction_ (faithfulness to source is the metric,
  hallucination is failure). Topic-gen = _generation_ (no source to be faithful to; the preview/edit
  gate is the only safety net). S01E01 grounding discipline applies hard to one, barely to the other.
- Separation could mean any of three levels — **decide which we actually want:**
  1. **Model defaults per task** — extraction gets one default model, generation another (cheap-strong
     extractor vs. a more capable generator). Cheapest change.
  2. **Separate prompt builders** — already half-true (`buildNotesPrompt` exists); split into
     `buildDecomposePrompt` vs `buildTopicNotePrompt` so they evolve independently.
  3. **Separate actions/agents** — `analyzeDocument()` vs `generateFromTopic()` as distinct server
     actions, distinct schemas if they diverge.

**Open fork:** how deep does the split go — just per-task model defaults (1), or full separate
actions (3)? My lean: (1)+(2) now, (3) only if the schemas actually diverge (YAGNI on a second schema).

## 2. "Reads document" path is its own thing

**Ask:** the read/analyze step should "probably be different."

**My read:** ties to #1. The _read_ stage (ingest file → text → chunk/structure) is distinct from the
_generate_ stage. Currently the deterministic split (#4) and the AI decompose (#3) share the import
surface. Question is whether the AI-read path needs its own model selection + its own prompt surface
separate from topic-generation. Likely yes if we accept #1. **Needs you to confirm what "different"
means here** — different model, different UI entry, or different pipeline.

## 3. Restrict accepted document types + make it obvious in the UI

**Ask:** constrain the accepted file types and surface them in the UI so the user knows.

**Current state:** Phase-1 accepts `.md` / `.markdown` / `.txt` via `FileReader` (no bucket).
**My read:** low-risk, high-clarity. Set the file input `accept` attribute to the allowlist + render
visible helper text ("Markdown or plain text — .md, .markdown, .txt"). Reject + clear message on
anything else (size cap already exists). PDF/image/audio remain explicitly OUT (separate future slice).
**Open fork:** is the allowlist still exactly `.md/.markdown/.txt`, or do you want to tighten/loosen?

## 4. Model select = searchable combobox, and many more models

**Ask:** replace the `<Select>` over ~5–8 curated models with a **combobox + search**, and expose
**many more** models.

**Tension to resolve — this reverses an earlier locked decision.** change.md (2026-06-06) explicitly
chose "**curated short list, NOT a live `/models` fetch**" (same "curate don't enumerate" call as S-13).
Wanting many more models pushes toward either:

- **(a)** a much larger _static_ curated list (still hand-maintained, goes stale), or
- **(b)** a **live OpenRouter `/models` fetch** (300+ models, always current) cached server-side, fed
  into a searchable combobox.

A searchable combobox is what makes (b) usable — search is the answer to "300 models is unusable."
**My lean:** if we want "many more," go (b) — live fetch, cache it (revalidate daily), validate the
chosen id server-side. This also unlocks #5 for free (pricing comes in the `/models` payload).
**Open fork:** confirm we're abandoning the curated-list decision and going live-fetch.

## 5. Token pricing input/output table (parked thought)

**Ask:** show per-model input/output token pricing somewhere. Explicitly _"just a thought, not
necessarily now."_

**My read:** OpenRouter's `/models` endpoint already returns `pricing.prompt` / `pricing.completion`
per model. So **if #4 goes live-fetch, this is nearly free** — render price columns in the combobox
rows. If #4 stays curated-static, we'd hand-maintain prices (they drift → wrong is worse than absent).
**Recommendation:** treat as a rider on #4. Build it iff #4 = live-fetch; otherwise defer. Parked.

## 6. GenerateDialog is too narrow — prompt overflows

**Ask:** widen the dialog; the prompt is unreadable / overflowing.

**My read:** pure layout. `GenerateDialog`'s `DialogContent` needs a wider `max-w` (shadcn default is
`max-w-lg`/`sm:max-w-lg`). Bump to something like `max-w-2xl`/`max-w-3xl` and let the prompt area
scroll vertically, not overflow horizontally. Trivial, do it whenever we touch the dialog.

## 7. Editable prompt textarea

**Ask:** the prompt is currently **preview-only** (`previewPrompt` renders it read-only). You want to
**edit** it in the textarea and have the edit be what's sent.

**My read — this is an architecture change, not just a UI one:**

- Today actions always rebuild the prompt server-side via `buildXPrompt(input)`. To honor an edited
  prompt, the action must accept an **optional `promptOverride { system, prompt }`** and use it instead
  of the builder.
- **Risk/decision:** an editable prompt sent raw to the model bypasses our grounding scaffolding. Fine
  for a power-user debug surface (this whole stream is "always-on debug"), but we should decide:
  does the edited prompt fully replace the builder output, or do we keep a fixed system prompt and only
  let the user edit the user-message body? My lean: **edit the full `{system, prompt}`** since the
  point is prompt refinement, but validate it's non-empty and cap length.
- The dialog flow becomes: `previewPrompt` populates the textarea → user edits → **Generate** sends the
  (possibly-edited) text → the same edit feeds `log-generation.ts` so the refinement trail is honest.

## 8. Move the whole "generate from a topic (AI)" input into the dialog

**Ask:** since the dialog exists anyway, move the entire topic-input UX (currently `TopicGenerator`'s
own input + button) **into** `GenerateDialog`. The dialog becomes the single AI-generation surface.

**My read:** consolidation. `GenerateDialog` would own: topic/text input → model combobox → editable
prompt preview → Generate → token counts → onResult. `TopicGenerator` collapses to just a trigger
button that opens the dialog (matching how #1/#3 already trigger it). Coherent — one surface, one flow
for all four entry points (#1 note→cards, #2 topic→card, #3 doc→notes, #5 topic→note).
**Open fork:** does the import surface (#3, which has its own file-upload + split-level UI) also fold
into this dialog, or does import stay its own page and only the _topic_ generators (#2/#5) move in?
The file-upload + deterministic-split UI is heavy; I lean **import stays its own surface**, and only
#2/#5 topic-gen moves into the dialog.

---

## Cross-cutting threads (what these 8 items actually cluster into)

- **A — Model layer rework (items 1, 4, 5):** per-task model defaults + live `/models` fetch + searchable
  combobox + optional pricing. This is the biggest piece and reverses the curated-list decision.
- **B — Dialog as the unified AI surface (items 6, 7, 8):** wider, editable prompt, absorbs topic input.
  Mostly UI + one action-signature change (`promptOverride`).
- **C — Read/ingest clarity (items 2, 3):** restrict + surface doc types; clarify the read path's
  separation from generation.

## Decisions

1. **Item 4 — RESOLVED (2026-06-07): live `/models` fetch.** Verified `GET /api/v1/models` is public,
   unauthenticated, and free (no token billing). Cache server-side, revalidate ~daily, validate chosen
   id against the cached list, handle stale/off-list. Reverses the 2026-06-06 curated-list decision.
2. **Item 5 — RESOLVED: IN, free.** Pricing comes in the same `/models` payload
   (`pricing.prompt`/`pricing.completion` + `input_cache_read`/`input_cache_write`). Render price
   columns in the combobox rows.

3. **Item 1 — RESOLVED (2026-06-07): NO split.** One default model + the per-generate combobox
   override (item 4). The split only ever mattered for import-decompose (#3); the remedy for bad
   extraction is "switch model in the dialog and re-run," backed by the preview/edit gate — the
   override IS the model-flexibility, so per-task defaults / separate actions buy nothing. Keep the
   decompose vs topic prompt builders separate (grounding content differs — already the code shape).
   No two-slot settings; `credential.model` stays a single default.

4. **PDF — RESOLVED (2026-06-07): IN, via path (B) multimodal vision** (S01E04, ref repo
   `01_04_reports`/`01_04_image_recognition`). NOT text-extraction — vision handles scanned + layout.
   - PDF import = **single vision call** → `{notes:[...]}` (model reads PDF, emits structured notes; no
     intermediate text step).
   - **Second, vision-only model picker** on the import/PDF surface: filter `/models` to entries whose
     `architecture.input_modalities` include `image`/`file`; default to a cheap vision model. The
     text surfaces (#1/#2/#5) keep the text-model picker.
   - **`credential.model` stays the single persisted default** (text). The vision picker is a
     per-generate choice, NOT a second persisted settings column.
   - **Scope flag:** this deliberately reopens S01E04 multimodal, which change.md parked as a future
     slice. Pulling it in expands scope against the 2026-06-10 deadline — accepted by operator.
   - **Verify at plan time (don't code from memory):** AI SDK v6 + OpenRouter **file/PDF input**
     contract (PDF as a `file` content part to `generateObject`); confirm ref-repo exact mechanism
     (OpenRouter vision model vs. a DeepSeek-OCR step). md/txt read path unchanged (deterministic).

5. **Item 7 — RESOLVED (2026-06-07): full `{system, prompt}` edit.** Textarea shows the complete built
   prompt (incl. injected source for grounded calls); user edits any of it; edited blob is what's sent
   AND what feeds `log-generation.ts`. Operator is actively testing and needs to modify it freely.
   Safety nets: `generateObject` enforces the Zod schema at SDK layer regardless of prompt; preview/edit
   gate catches bad content. Validate non-empty + length cap. Deleting source mid-edit → grounded call
   silently becomes ungrounded (accepted; visible in the prompt).
   - **Action change:** `generateCards`/`generateNotes` accept optional `promptOverride {system, prompt}`
     and use it instead of `buildXPrompt(input)` when present.

6. **Item 8 — RESOLVED (2026-06-07): Shape A — dialog generates, host view commits.**
   - **Dialog owns** (configure + fire): source `<textarea>` + optional file upload (md/txt/pdf) +
     model picker (text or vision-filtered per source) + editable `{system, prompt}` preview +
     Generate + token counts.
   - **Host view owns** (review + commit): on success the dialog closes; N results land in an editable
     preview area in the host (subject page or import area) for edit/skip + subject assignment + commit.
   - Subject target from context: on a subject → that subject; standalone import page → new/existing picker.
   - Rationale: modal is right for configure-and-fire, wrong for review-and-edit-many-then-commit
     (that needs width + persistence). All four entry points trigger the same dialog; results render
     in their host. Matches today's `GenerateDialog`-fires-then-panel-renders flow, minus moving the
     source input into the modal.
7. **Item 9 — RESOLVED (2026-06-07): source field = `<textarea>`, not `<Input>`.** The "ask AI to
   generate a note / card / anything for the subject" input must be multi-line — you paste prose or
   write a long instruction, not a one-liner. Applies to the unified dialog's source field.

## Factual correction (verified in code, 2026-06-07) — re item 8 + "dump text to organize"

- **"Dump text → AI organizes into notes" is ALREADY built.** `import-panel.tsx:154` mounts a
  `GenerateDialog` "Decompose with AI" → `generateNotes({ text })` → `applyDecomposition` → the same
  editable preview/commit pipeline as the deterministic split. #3 works today.
- So the operator's "it can only import" is a **framing/discoverability gap, not a missing capability**:
  the feature is buried on the Import _page_, behind paste-then-find-button, and always lands in the
  import page's own new/existing-subject batch flow. It is NOT offered as an in-context "organize this
  text **for this subject**" action. **Fix = surface + relocate, not build extraction.**
- **Current architecture (reframes item 8):** `GenerateDialog` is already the AI-config modal (model +
  prompt preview). What lives OUTSIDE it: (a) the **source input** (import panel's textarea), and
  (b) the **result preview + subject picker + commit** (bottom half of `import-panel.tsx`). "Move import
  into the dialog" = deciding which of (a)/(b) move in.
- **New thread surfaced:** generation scoped to a **subject you're viewing** ("generate note/card for
  this subject"). Placement decision — an in-context entry on the subject view, target = that subject,
  not a standalone import page. Capture; confirm with operator.
  - **OPERATOR (2026-06-07): REJECTED subject-view entry. "I want it on import page only — but this
    needs discussing."** The organize-text capability stays on the Import page. Open question: what the
    Import page should _become_ (it already has "Decompose with AI" at `import-panel.tsx:154`). Under
    discussion — see "Import page scope" below.

## Settled this session (planning round, 2026-06-07)

- **Checkpoint:** operator commits the green model-select + AI-gate stream BEFORE planning finalizes →
  plan **prerequisite**, not a phase.
- **Model list UX:** combobox shows a pinned **"Recommended"** group (current curated ids) on top, full
  searchable live `/models` list below. Curated list survives as a UX nicety, not the only source.

## Import page scope — RESOLVED (2026-06-07)

- **Notes only. Grounded only.** No card-gen, no topic-gen on the import page (those stay on their
  own surfaces — #1 note/card surfaces, #2/#5 the new-note/new-card forms).
- **"Organize my text" already works** — operator confirmed `import-panel.tsx:154` "Decompose with AI"
  takes pasted prose → AI notes today. The gap was **discoverability/presentation**, NOT capability:
  the page leads with three H1/H2/H3 split buttons and the AI path reads as an afterthought.
- **→ This thread = UX restructure**, not new functionality. Make the "paste prose → AI organizes into
  notes" path first-class alongside (not behind) the deterministic split. Folds into the dialog rework
  (item 8: import's generate step routes through the unified dialog; Shape A). PDF (vision) is the one
  net-new _capability_ added to this page.

## Import page UI refinements (Phase 2 — operator feedback + screenshot 2026-06-07)

Operator: "ui needs refinements it is super confusing." Concrete, from the screenshot:

1. **Move explanatory copy to the top.** The two help paragraphs ("Each H1 heading…" / "Split cuts on
   headings… Decompose with AI…") currently render BELOW the controls — read-buttons-then-explanation,
   backwards. Move directly under the **"Import notes"** heading as intro copy, before upload/paste.
2. **Visually separate the two strategies.** "Split on heading level: H1 H2 H3" sitting flush against
   "Decompose with AI" makes a deterministic toolbar and an AI action look like one peer control group
   → reads as confusing. Phase 2 separates "structured doc → Split" from "messy prose → Decompose with
   AI" as two distinct paths, not one button row.
3. **"I still don't get why …"** — operator sentence cut off (likely: why unstructured paste shows
   "Preview — 1 note" = deterministic split auto-running, pre-H1 text → one "Untitled" note). PENDING
   operator clarification before finalizing Phase 2 copy/behavior.

## Resolved design — summary (all forks closed 2026-06-07)

1. **Model source = live OpenRouter `/models`** (public, free), cached server-side (~daily revalidate),
   chosen id validated against cache. Replaces the curated list.
2. **Model picker = searchable combobox** with per-row **input/output pricing** (from `/models`).
3. **Per-surface filtered candidates:** text surfaces (#1/#2/#5, md/txt decompose) → text models;
   PDF/vision surface → models whose `input_modalities` include image/file. One persisted text default
   (`credential.model`); vision pick is per-generate, not persisted.
4. **No model split** for extraction-vs-generation — per-generate override is the quality lever.
   Keep separate decompose/topic prompt builders (grounding content differs).
5. **PDF in, via multimodal vision** — single vision call → `{notes}`; reopens S01E04 (accepted).
6. **Unified dialog (Shape A):** source `<textarea>` + optional file upload + model combobox + **editable
   `{system, prompt}`** + Generate + token counts, **wider** `DialogContent`. Results land in the host
   view's editable preview for edit/subject/commit. All four entry points trigger it; topic-gen
   (#2/#5) folds fully in; import's generate step folds in, its commit stays on the page.
7. **Action change:** `generateCards`/`generateNotes` accept optional `modelId` **and** `promptOverride`.
8. **Surface the "organize my text" capability** (already built as #3) as a first-class, subject-scoped
   action — not buried on the Import page.

## Sequencing — READ BEFORE PLANNING

This iteration **supersedes large parts of the now-complete model-select stream**, building on it:

- **CORRECTION (2026-06-07, verified `tsc --noEmit`):** typecheck is **GREEN**. The model-select +
  prompt-debug stream is fully wired (`PreviewInputT` complete, `defaultModel` threaded through
  card-form/note-form/route pages) — the review doc's "RED / 4 errors" is **stale**. The stream is
  coherent and green, but **uncommitted** (model-select.tsx, generate-dialog.tsx, etc. are untracked/
  modified in git status). Iteration-2 reshapes the very files this stream owns (the `<Select>` →
  searchable combobox, the read-only preview → editable, topic input → into dialog).
- **Do NOT separately "finish" the old curated-`Select` picker just to replace it with the combobox.**
  Fold iteration-2 into ONE coherent plan that takes the AI-config surface from its current half-state
  straight to green. `model-select-and-prompt-debug-design.md` is the v1 of this surface; this doc
  **amends** it (live-fetch combobox replaces curated Select; editable prompt replaces read-only
  preview; topic input moves into the dialog; PDF/vision is net-new).
- The AI-button-gate stream (AG-\*) is clean and adopted (`GenerateDialog` consumes `useAiGate` +
  `variant="ai"`) — keep it; just honor AG-1/AG-2 cleanups when touching those files.

## Still-open prior debt (unchanged, not part of this dump)

- AG-1 (triplicated Connect CTA), AG-2 (`useAiGate` placement), AG-4 (plan drift: always-render vs hide).
