---
date: 2026-06-09T20:51:59+0200
researcher: ex-Plant
git_commit: d3fa7443e11000bd1652134b61e73fec7b288d9f
branch: feat/new-user-welcome-dialog
repository: 10x_devs
topic: 'Markdown render XSS guard (test-plan Phase 7, R#7) — ground the render pipeline, the urlTransform default, and every untrusted body source'
tags: [research, codebase, markdown, xss, security, react-markdown, test-plan, phase-7]
status: complete
last_updated: 2026-06-09
last_updated_by: ex-Plant
---

# Research: Markdown render XSS guard (test-plan Phase 7 / R#7)

**Date**: 2026-06-09T20:51:59+0200
**Researcher**: ex-Plant
**Git Commit**: d3fa7443e11000bd1652134b61e73fec7b288d9f
**Branch**: feat/new-user-welcome-dialog
**Repository**: 10x_devs

## Research Question

Phase 7 of `context/foundation/test-plan.md` ("Markdown render XSS guard", risk R#7): prove a note body
carrying `<script>`, an `on*=` handler, and a `javascript:`/`data:text/html` link renders **inert** — no
script runs, no element/handler injected into the DOM, dangerous href neutralized. Challenge the assumption
"we don't use rehype-raw, so we're safe." Ground: every remark/rehype plugin in the pipeline; the
`urlTransform` default + any override; any custom `a`/`img` component; **every untrusted source** feeding the
renderer (user editor, `.md` import, AI body, token API). Plus two test-plan §2 backport rows: (D.1)
user-markdown XSS is live today; (D.2) ordering integrity.

## Summary

The render pipeline is **one source-agnostic function** and is, on today's code, safe by construction:
`remark-gfm` + `@shikijs/rehype` only — **no `rehype-raw`, no `urlTransform` override, no custom `a`/`img`
components, no `dangerouslySetInnerHTML` on user content**. react-markdown's default escaping makes raw HTML
(`<script>`, `on*=` handlers) inert text, and its `defaultUrlTransform` neutralizes any non-`safeProtocol`
URL to the **empty string** (verified against the installed `react-markdown@10.1.0`).

Three findings reshape the Phase 7 scope:

1. **The existing guard is real but partial.** `e2e/notes.spec.ts:85-107` already proves the **user** path
   renders `<script>` + `<img onerror>` inert. It does **NOT** cover the dangerous-**URL** path
   (`[x](javascript:…)`, `data:text/html`) — which is a _different mechanism_ (`urlTransform`, not
   raw-HTML escaping) and is **wholly untested**. That URL-neutralization assertion is the real coverage gap.

2. **The "AI body source" already exists — test-plan.md is stale.** §3/§2 claim the AI surface is "unbuilt
   (S-19 Phase 2)". It is built and archived (`context/archive/2026-06-06-import-markdown-to-notes/`,
   2026-06-07): `generate-notes.ts` emits AI note **bodies** (text/topic + PDF-vision) that flow through the
   _identical_ `import_notes` → `RenderMarkdown` path as user notes. There are **four** live untrusted
   body-write paths today (user editor, `.md` import, AI generation, token API) plus the memory-card markdown
   fields — **all converging on the single `RenderMarkdown` pipeline**.

3. **Convergence is the key cost×signal lever.** Because every source lands in the same renderer with no
   per-source sanitization (`contentSchema = z.string()`, no HTML filter anywhere), testing the _render_
   battery once (high signal) plus proving _convergence_ of the other sources (cheap) beats running the same
   payload through four ingestion UIs (expensive, low marginal signal — and the AI path needs a live BYOK
   OpenRouter key, which is hard to drive in E2E).

## Detailed Findings

### The render pipeline (the entire XSS defense)

- `src/components/markdown/markdown-plugins.ts:15` — `REMARK_PLUGINS = [remarkGfm]`
- `src/components/markdown/markdown-plugins.ts:17-27` — `REHYPE_PLUGINS = [[rehypeShiki, {…}]]`
- Single shared pipeline consumed by **both** renderers:
  - `src/components/markdown/render-markdown.tsx:9-16` — server detail view (`MarkdownAsync`). Comment at
    `:8` states the safety intent: _"No rehype-raw, so raw HTML stays escaped and note bodies can't inject
    executable markup."_
  - `src/components/markdown/markdown-preview.tsx:14-25` — client live preview (`MarkdownHooks` + sync
    `Markdown` fallback).

**Negative confirmations (grepped `src/`, 0 hits each):** `rehype-raw` / `rehypeRaw`, `rehype-sanitize`,
`skipHtml`, `allowDangerousHtml`, `allowedElements`, `disallowedElements`, `urlTransform`, `components={`
on any Markdown call. The only `dangerouslySetInnerHTML` in the repo is `src/components/ui/chart.tsx:89`
(static CSS theme injection — **not** markdown, not user content).

**Versions (package.json):** `react-markdown ^10.1.0`, `remark-gfm ^4.0.1`, `@shikijs/rehype ^4.1.0`,
`shiki ^4.1.0`. No raw/sanitize rehype packages installed at all.

### The `urlTransform` default — verified against reality

`node_modules/react-markdown/lib/index.js:421-444` (`defaultUrlTransform`) +
`:124` (`safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i`) + `:320` (default applied when no override) +
`:382` (applied to every URL property, i.e. both `href` and `src`):

- A URL whose protocol is **not** http/https/ircs/mailto/xmpp returns `''` (empty string).
- So `[x](javascript:alert(1))` → `<a href="">x</a>`; `[x](data:text/html,…)` → `<a href="">x</a>`;
  `![x](javascript:…)` → image with empty `src`. Relative URLs and `#`/`?`-first colons pass through
  (treated as non-protocol).

**Test oracle (this is the anti-pattern guard R#7 demands):** assert the **rendered anchor's `href`
attribute is empty / not the original `javascript:`|`data:` string** — i.e. our pipeline's _observable
output_, never react-markdown's internal escaping and never "no alert appeared."

### Renderer call sites (every place untrusted markdown is rendered)

| Content                          | Component                              | Call site                                                          |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| note body (read view)            | `RenderMarkdown`                       | `src/app/(protected)/notes/[id]/page.tsx:87`                       |
| note body (subject sidebar)      | `RenderMarkdown`                       | `src/app/(protected)/subjects/[id]/[noteId]/page.tsx:31`           |
| card example                     | `RenderMarkdown`                       | `src/features/memory-cards/components/memory-cards-section.tsx:71` |
| card code_context                | `RenderMarkdown`                       | `src/features/memory-cards/components/memory-cards-section.tsx:84` |
| card prompt/example/code_context | `RenderMarkdown`                       | `src/features/review/components/review-panel.tsx:49,56,57`         |
| card form preview                | `MarkdownPreview`                      | `src/features/memory-cards/components/memory-card-form.tsx:82`     |
| note editor preview              | `MarkdownPreview` (dynamic, ssr:false) | `src/components/markdown/editor-with-preview.tsx:58`               |

All render `RenderMarkdown` (`.prose` container) or `MarkdownPreview` from the same plugin set. **No call site
adds a `components` override or `urlTransform`.**

### Untrusted source inventory — what's LIVE today

| Source                                                 | Built?                              | Entry point                                                                                                                                                       | Reaches renderer?                                | Sanitized in?                                                                                                           |
| ------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| User editor (CodeMirror → Server Action)               | **Yes**                             | `src/features/notes/actions/create-note.ts` / `update-note.ts`                                                                                                    | Yes                                              | No — `contentSchema = z.string()` (`src/features/notes/schemas.ts:11`)                                                  |
| `.md` import                                           | **Yes** (archived 2026-06-06)       | `src/features/import/components/import-panel.tsx` → `actions/import-notes.ts:14` (`import_notes` RPC)                                                             | Yes (same note rows)                             | No                                                                                                                      |
| **AI-generated note body**                             | **Yes**                             | `src/features/openrouter/actions/generate-notes.ts:53` (text/topic) + `:38-50` (PDF-vision) → `import-panel.tsx:67` `applyDecomposition` → drafts → `importNotes` | **Yes — same `import_notes` → `RenderMarkdown`** | No — `keepCompleteNotes` (`utils/sanitize-generated.ts:14`) only drops blank-field notes, **not** an HTML/script filter |
| Token HTTP API (note body)                             | **Yes** (S-20, archived 2026-06-09) | `src/app/api/notes/route.ts:12` POST → `insertNoteWithChecks` (same core as the form)                                                                             | Yes                                              | No — reuses `contentSchema = z.string()`; RLS scopes ownership, not body content                                        |
| PDF import                                             | **Yes** — a branch of the AI path   | `generate-notes.ts:38-50` (`mediaType: 'application/pdf'`)                                                                                                        | Yes (via AI path)                                | No                                                                                                                      |
| Memory-card fields (`prompt`/`example`/`code_context`) | **Yes**                             | API `memory-cards/route.ts`; UI forms; AI `generate-cards.ts`                                                                                                     | Yes (card render sites above)                    | No — adjacent untrusted markdown surface                                                                                |

**Resolution of the test-plan staleness:** `context/foundation/roadmap.md ## Done` + `context/archive/2026-06-06-import-markdown-to-notes/`
confirm S-19 shipped all phases (incl. gen-notes + PDF-vision) and archived 2026-06-07. test-plan.md §3
(lines 51-52, 91, 95) and §2 row R#7 (line 55) still describe the AI surface as "unbuilt / forward-looking"
and gate Phases 4/5/7 on it. **That wording predates the archive and is factually wrong** — Phase 7 should
correct it.

### Existing XSS test coverage

- `e2e/notes.spec.ts:85-107` — _"note body raw HTML is rendered inert, not executed (no stored XSS)"_.
  Payload (`:91`): `<script>window.__xssRan = true</script>\n\n<img src=x onerror="window.__xssImg = true">`.
  Asserts: `.prose script` count 0 (`:97`), `.prose img` count 0 (`:98`), `window.__xssRan`/`__xssImg`
  falsy (`:99-104`), markup survives as escaped visible text (`:106`).
- **No other XSS test exists** (grepped `xss`/`onerror`/`javascript:`/`sanitiz`/`rehype-raw` across `e2e/` +
  `src/__tests__/`). **No test covers a dangerous link/image URL** (`javascript:` / `data:text/html`) — the
  `urlTransform` mechanism is entirely unguarded.

### §2 backport context (source: `context/changes/test-suite-audit/test-suite-audit.md` §D)

- **(D.1) Stored XSS is live today.** §2's only XSS row (R#7) says protection is "untested," but the user path
  _is_ guarded (`notes.spec.ts:85`), and user-authored markdown is a **live, non-AI** injection surface now —
  R3 (untrusted input) covers only the AI path. Backport = register the existing guard + the user/import
  surfaces in §2, and drop the stale "untested / unbuilt AI" framing.
- **(D.2) Ordering integrity.** Unrelated to XSS. `e2e/subjects.spec.ts` has reorder tests tracing to no §2
  risk, while `src/features/subjects/` is high-churn; `src/features/subjects/actions/reorder-note.ts` writes a
  fractional `position` with a known float-precision degeneracy (no rebalance — see
  `context/archive/2026-06-04-subject-sidebar-nav/research.md:50`). This is a §2 **risk-map maintenance** item,
  **out of scope** for the Phase 7 XSS spec — flagged here only because it rode in on the same audit.

### E2E authoring helpers (`e2e/helpers.ts`)

- `uniqueEmail(tag = '')` (`:17`), `signUp(page, email)` (`:31`, lands `/dashboard`), `createNote(page, title)`
  (`:41`, lands `/notes/<id>`, 15s timeout), `fillEditor(page, value)` (`:61`).
- `fillEditor` inserts via `document.execCommand('insertText', …)` (`:64`) to dodge CodeMirror `closeBrackets`
  corrupting ` ``` ` fences / `{`. On a multi-editor page use `.cm-content` `.first()` (lesson: §"A page in
  edit mode can render >1 CodeMirror"). `/notes/new` is single-editor, so the bare helper is fine.

## Code References

- `src/components/markdown/markdown-plugins.ts:15-27` — the only plugin config (remark-gfm + rehypeShiki)
- `src/components/markdown/render-markdown.tsx:8-16` — server renderer + safety-intent comment
- `src/components/markdown/markdown-preview.tsx:14-25` — client renderer
- `node_modules/react-markdown/lib/index.js:124,320,382,421-444` — `safeProtocol` + `defaultUrlTransform`
- `src/features/notes/schemas.ts:11` — `contentSchema = z.string()` (no content sanitization)
- `src/features/openrouter/actions/generate-notes.ts:38-53` — AI note-body generation (text + PDF-vision)
- `src/features/import/actions/import-notes.ts:14` — `import_notes` RPC (shared by user/import/AI paths)
- `src/app/api/notes/route.ts:12` — token-API note POST (same `insertNoteWithChecks` core)
- `e2e/notes.spec.ts:85-107` — existing raw-HTML inertness guard (user path)
- `e2e/helpers.ts:17,31,41,61` — auth/editor helpers

## Architecture Insights

- **Single-pipeline convergence is the central design fact.** Every untrusted body source funnels into one
  `RenderMarkdown`/`MarkdownPreview` pair with one plugin set. The XSS guard is **purely render-layer**;
  there is no input-side sanitization anywhere (`contentSchema = z.string()`). This is _why_ R#7 is framed as
  a render test, and why a single payload battery against the renderer is the high-signal proof — the source
  is irrelevant to the render outcome **as long as no source bypasses the renderer** (none does today).
- **Two distinct neutralization mechanisms** must each be asserted: (a) raw-HTML escaping (no rehype-raw) →
  `<script>`/`on*=` inert; (b) `urlTransform` → dangerous `href`/`src` emptied. The existing test only proves
  (a). (b) is the gap.
- **The regression these tests guard is a future edit, not today's code.** Today is safe by construction; the
  value of the test is a tripwire that turns red the moment someone adds `rehype-raw`, a permissive
  `urlTransform` override, or a custom `a`/`img` component that reads `href`/`src` raw. The assertions must be
  observable-DOM facts (no live `<script>`/`<img>`, empty dangerous href), so they actually fail on
  re-enablement.

## Historical Context (from prior changes)

- `context/archive/2026-06-06-import-markdown-to-notes/change.md` — S-19 shipped all phases incl. AI gen-notes
  - PDF-vision; XSS was _assumed_ inherited from the render pipeline, never re-checked for the import/AI
    surface (no rehype-raw decision recorded for those paths).
- `context/changes/test-suite-audit/test-suite-audit.md` §D — origin of the (D.1) stored-XSS and (D.2)
  ordering-integrity §2 gaps.
- `context/archive/2026-06-04-subject-sidebar-nav/research.md:50` — fractional `position` precision
  degeneracy behind (D.2).

## Open Questions (for /10x-plan)

1. **Scope of source coverage.** Given single-pipeline convergence, does the plan author (a) ONE render-battery
   E2E on the user path (script + on\*= + javascript: link + data:text/html link) asserting inert DOM + empty
   dangerous href, plus (b) a cheap convergence proof for import/AI/API (code-path note + maybe one import-path
   E2E), rather than 4 full ingestion E2Es? Recommendation: yes — (a)+(b). The AI path needs a live BYOK key,
   so an E2E there is impractical; assert convergence by the shared `import_notes`→`RenderMarkdown` path.
2. **Extend the existing test vs add a new one?** The existing `notes.spec.ts:85` already covers (a)'s
   raw-HTML half on the user path. Add the dangerous-URL assertions there, or author a dedicated
   `markdown-xss.spec.ts`? (Leaning: a dedicated spec — clearer intent, own note, no contamination of the
   CRUD-focused file.)
3. **test-plan.md corrections** are in-scope per the change notes: update §2 R#7 (drop "untested/unbuilt"),
   register the existing guard, add the four live sources; decide whether (D.2) ordering integrity is logged
   as a separate §2 row now or deferred (it is NOT part of this spec's implementation).
4. **Card fields** (`prompt`/`example`/`code_context`) are an adjacent untrusted markdown surface through the
   same renderer — include in the render-battery assertions, or note as covered-by-convergence?

## Related Research

- `context/changes/test-suite-audit/test-suite-audit.md` (the §2 gap audit feeding D.1/D.2)
- `context/foundation/test-plan.md` §2 (R#7), §3 (Phase 7), §7 (markdown render fidelity exclusion — note: §7
  excludes _fidelity/snapshots_, NOT the security guard)
