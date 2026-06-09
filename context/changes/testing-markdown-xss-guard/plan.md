# Markdown Render XSS Guard (test-plan Phase 7) Implementation Plan

## Overview

Author a dedicated E2E spec proving that **untrusted markdown renders inert** through the project's single
`RenderMarkdown` pipeline — no script execution, no injected element/handler, and dangerous `javascript:` /
`data:text/html` URLs neutralized — across two real ingestion paths (the user editor and the `.md` import).
Then correct the now-stale test-plan §2/§3 (the AI body surface is built, not "unbuilt") and account for the
two backport rows the test-suite audit surfaced (D.1 stored-XSS-live-today, D.2 ordering-integrity).

This closes test-plan §3 **Phase 7 / risk R#7**. The render pipeline is already safe by construction today;
the value of this work is a **regression tripwire** that turns red the moment someone re-enables execution
(adds `rehype-raw`, a permissive `urlTransform` override, or a custom `a`/`img` component).

## Current State Analysis

(Grounded by `context/changes/testing-markdown-xss-guard/research.md`.)

- **One source-agnostic pipeline.** `src/components/markdown/markdown-plugins.ts:15-27` = `remark-gfm` +
  `@shikijs/rehype` only. **No `rehype-raw`, no `urlTransform` override, no custom `components`, no
  `dangerouslySetInnerHTML` on user content.** Both renderers — `render-markdown.tsx:9-16` (server
  `MarkdownAsync`) and `markdown-preview.tsx:14-25` (client `MarkdownHooks`) — import this unchanged.
- **Two distinct neutralization mechanisms.** (a) react-markdown without `rehype-raw` escapes raw HTML
  (`<script>`, `on*=` handlers) to inert text. (b) `defaultUrlTransform`
  (`node_modules/react-markdown/lib/index.js:421-444`, `safeProtocol` at `:124`) returns `''` for any
  protocol outside `http(s)|ircs|mailto|xmpp`, applied to both `href` and `src` (`:382`). Verified against
  installed `react-markdown@10.1.0`.
- **The existing guard is partial.** `e2e/notes.spec.ts:85-107` proves the **raw-HTML** half on the **user
  path only** (`<script>` + `<img onerror>` inert). It does **NOT** assert URL neutralization, and covers no
  other source. **The dangerous-URL path is wholly untested** — that is the real gap.
- **Four live untrusted body sources, all converging on `RenderMarkdown`, none sanitized in** (`contentSchema
= z.string()`, `src/features/notes/schemas.ts:11`): user editor; `.md` import (`import-notes.ts:14` →
  `import_notes` RPC); AI generation (`generate-notes.ts` text + PDF-vision → same import drafts); token HTTP
  API (`src/app/api/notes/route.ts:12` → `insertNoteWithChecks`). Memory-card fields render through the same
  pipeline too.
- **test-plan.md is factually stale.** §2 R#7 (line 55) and §3 (lines 51-52, 91, 95) call the AI surface
  "unbuilt (S-19 Phase 2)"; it shipped and archived 2026-06-07 (`context/archive/2026-06-06-import-markdown-to-notes/`).
- **Import is E2E-drivable with no BYOK key** (`e2e/import-notes.spec.ts:33-48`): `getByTestId('import-file')
.setInputFiles({ buffer })` → `import-level-h1` → `import-commit`. Deterministic split passes body text
  verbatim — payloads survive to render.

## Desired End State

A new `e2e/markdown-xss.spec.ts` is green in the suite and asserts, on **both** the user-editor path and the
`.md`-import path, that a body carrying `<script>`, an `on*=` handler, a `javascript:` link, and a
`data:text/html` link renders inert with dangerous hrefs neutralized. The superseded user-path guard is
removed from `e2e/notes.spec.ts`. `context/foundation/test-plan.md` §2/§3 reflect reality: R#7 registers the
existing+new guard and the four live sources, D.1 is framed, and D.2 is logged as a separate (un-implemented)
row.

**Verify**: `pnpm test:e2e` passes including the new spec; `e2e/notes.spec.ts` no longer contains the
raw-HTML test; `test-plan.md` no longer says the AI surface is "unbuilt".

### Key Discoveries:

- `defaultUrlTransform` empties dangerous hrefs → assert `<a>` has empty/absent `href`, not the input string
  (`node_modules/react-markdown/lib/index.js:421-444`). This is the anti-pattern guard R#7 demands: test our
  pipeline's observable output, not react-markdown internals.
- The existing test (`e2e/notes.spec.ts:91`) uses `<img src=x onerror=...>` as the `on*=` vector and asserts
  `window.__xssImg` stays falsy — reuse that exact technique.
- Import payloads must avoid `#` at line start colliding with the H1 split (`import-level-h1`); put the
  payload in the note **body**, not the heading line.
- `fillEditor` uses `execCommand('insertText')` to dodge CodeMirror's `closeBrackets` corrupting fences
  (`e2e/helpers.ts:61-65`); `/notes/new` is single-editor so the bare helper is safe.

## What We're NOT Doing

- **Not** adding input-side sanitization or any app-code change — the render layer is the guard by design;
  this change only _tests_ it.
- **Not** running the payload through the AI-generation or token-API ingestion UIs as E2E (AI needs a live
  BYOK OpenRouter key; both hit the identical `import_notes`/`insertNoteWithChecks`→`RenderMarkdown` core —
  convergence is documented via file refs, not re-tested).
- **Not** implementing the D.2 ordering-integrity coverage — it is unrelated to XSS; this change only _logs_
  it as a §2 row for a future phase.
- **Not** adding a separate memory-card-field XSS test — card fields use the same `RenderMarkdown`; covered by
  convergence, noted in docs.
- **Not** testing Shiki token colors / markdown-to-HTML fidelity (test-plan §7 negative space).

## Implementation Approach

Two phases. Phase 1 is the executable guard: one spec, two tests (user path, import path), each firing the
full payload battery and asserting both inert-DOM and neutralized-href. The existing partial guard migrates
into it. Phase 2 reconciles the test-plan doc with reality and lands both backport rows. Phase 1 must land and
pass before Phase 2's `## Done`/status edits are honest.

## Critical Implementation Details

**User-experience spec** — the URL-neutralization assertion is the load-bearing new coverage and must assert
the _observable_ DOM, not absence of an alert: locate the rendered anchors for the `javascript:` and
`data:text/html` links and assert their `href` is empty (or not equal to the dangerous input). A test that
only checks "no alert dialog appeared" passes even when the payload failed to fire for an unrelated reason
(R#7's named anti-pattern).

**Timing & lifecycle** — the import-path test must wait for the post-commit redirect to `/subjects/<id>`
(`toHaveURL(/\/subjects\/[0-9a-f-]+/, { timeout: 15_000 })`, per `import-notes.spec.ts:50`) then navigate into
the imported note before asserting on `.prose`, because the subject landing lists notes, it doesn't render
their bodies.

## Phase 1: XSS render-battery spec (user path + import path)

### Overview

Create `e2e/markdown-xss.spec.ts` with two tests proving inert render + href neutralization on the two
key-driven ingestion paths, and remove the superseded guard from `e2e/notes.spec.ts`.

### Changes Required:

#### 1. New XSS battery spec

**File**: `e2e/markdown-xss.spec.ts`

**Intent**: Prove untrusted markdown renders inert and dangerous URLs are neutralized, on both the user-editor
and `.md`-import ingestion paths — the Phase 7 / R#7 regression tripwire.

**Contract**: Two `test(...)` blocks using `signUp`, `uniqueEmail`, `fillEditor` from `./helpers`. A shared
payload constant carrying four vectors:

- `<script>window.__xssRan = true</script>` (raw-HTML script)
- `<img src=x onerror="window.__xssImg = true">` (raw-HTML `on*=` handler)
- `[click-js](javascript:window.__xssLink=true)` (dangerous-URL link)
- `[click-data](data:text/html,<script>window.__xssData=true</script>)` (dangerous-URL link)

Assertions per path (after landing on the note detail `/notes/<id>` and locating `.prose`):

- `await expect(page.locator('.prose script')).toHaveCount(0)`
- `await expect(page.locator('.prose img')).toHaveCount(0)`
- `window.__xssRan` / `__xssImg` / `__xssLink` / `__xssData` all falsy via `page.evaluate`
- raw script text survives escaped: `await expect(page.getByText('window.__xssRan = true')).toBeVisible()`
- **dangerous-href neutralized**: for each dangerous link's rendered `<a>` (locate by link text `click-js` /
  `click-data` within `.prose`), assert its `href` is empty / does not start with `javascript:` or `data:`
  (e.g. `expect(await anchor.getAttribute('href')).not.toMatch(/^(javascript|data):/i)`).

Test A (user path): `signUp` → `/notes/new` → `fillEditor(page, PAYLOAD)` → Create note → assert.
Test B (import path): `signUp` → `/import` → `getByTestId('import-file').setInputFiles({ name:'xss.md',
mimeType:'text/markdown', buffer: Buffer.from('# XSS note\n\n'+PAYLOAD) })` → `import-level-h1` →
`import-subject-new-mode` + title → `import-commit` → wait for `/subjects/<id>` redirect → click the imported
note → assert on `.prose`. (Header line is a benign `#` title; payload lives in the body so it isn't split.)

A leading file-header comment documents the convergence rationale: all four sources (user, import, AI via
`generate-notes.ts`, token API via `src/app/api/notes/route.ts`) write through the same
`insertNoteWithChecks` / `import_notes` core into the same `RenderMarkdown` pipeline; the AI and token-API
paths are covered-by-convergence (no separate E2E — AI needs a live BYOK key, identical renderer). Reference
`render-markdown.tsx:8` and `markdown-plugins.ts` for the pipeline; cite the lesson on `--shiki`/locator
conventions only if relevant.

#### 2. Remove superseded guard

**File**: `e2e/notes.spec.ts`

**Intent**: The raw-HTML inertness test (lines 85-107) is superseded by the new spec's user-path test (which
covers a strict superset: same script+img vectors plus the URL vectors). Remove it to avoid duplicate
coverage and a second place to maintain.

**Contract**: Delete the `test('note body raw HTML is rendered inert, not executed (no stored XSS)', …)`
block and its preceding explanatory comment (`e2e/notes.spec.ts:81-107`). Leave the S-13 fallback test and
the CRUD/edit tests untouched.

### Success Criteria:

#### Automated Verification:

- Lint passes on changed files: `pnpm exec eslint e2e/markdown-xss.spec.ts e2e/notes.spec.ts`
- Typecheck passes: `pnpm typecheck`
- The new spec passes: `pnpm test:e2e markdown-xss` (local Supabase stack up via `supabase start`)
- The notes spec still passes after the removal: `pnpm test:e2e notes`

#### Manual Verification:

- Both tests in `markdown-xss.spec.ts` fail if `rehype-raw` is temporarily added to `REHYPE_PLUGINS` (proves
  the raw-HTML assertions are real, not vacuous) — revert after.
- The dangerous-href assertion fails if a permissive `urlTransform={(u)=>u}` is temporarily passed to the
  renderer (proves the URL assertion is real) — revert after.
- `e2e/notes.spec.ts:85` test is gone; no other spec references it.

**Implementation Note**: After Phase 1 automated verification passes, pause for human confirmation of the
manual mutation checks before proceeding to Phase 2.

---

## Phase 2: test-plan.md corrections + backport

### Overview

Reconcile `context/foundation/test-plan.md` with the grounded reality and land both audit backport rows.

### Changes Required:

#### 1. §2 Risk Map — R#7 row + D.1

**File**: `context/foundation/test-plan.md`

**Intent**: R#7's Source cell says protection is "untested" and frames the AI source as "unbuilt
forward-looking" — both false now. Register the existing+new guard, the four live sources, and the D.1
stored-XSS-live-today framing.

**Contract**: Edit the R#7 row (line 55) and its surrounding notes (lines 51-52, 57): drop "and is untested";
note the render guard is now covered by `e2e/markdown-xss.spec.ts` (user + import paths) with AI + token-API
covered-by-convergence; correct the "S-19 Phase 2 (unbuilt — forward-looking)" framing to "built + archived
2026-06-07". Add the D.1 distinction that **user-authored** markdown is a live, non-AI injection surface (not
only the R3 AI path). Keep the Impact/Likelihood scores.

#### 2. §3 Phased Rollout — Phase 7 row + gating note

**File**: `context/foundation/test-plan.md`

**Intent**: Phase 7 status/framing must reflect that the AI source is live and the guard now exists.

**Contract**: Update the Phase 7 row (line 87) Status per the slice-review-gate outcome (it reaches
`complete` at archive). Correct lines 91/95: the AI surface is built, so Phase 7 covers user + import +
(by convergence) AI + token-API today — remove the "gated on S-19 unbuilt" dependency for Phase 7. Note
memory-card fields are covered-by-convergence (same `RenderMarkdown`).

#### 3. §2 — D.2 ordering-integrity row (logged, not implemented)

**File**: `context/foundation/test-plan.md`

**Intent**: Record the second audit backport as a distinct, future risk row so it isn't forgotten — without
implementing it in this XSS change.

**Contract**: Add a new §2 risk row for subject/note ordering integrity (`reorder-note.ts` fractional-position
degeneracy; high-churn `src/features/subjects/`), Source citing
`context/changes/test-suite-audit/test-suite-audit.md` §D and
`context/archive/2026-06-04-subject-sidebar-nav/research.md:50`. Mark it as not-yet-covered. Do **not** add a
§3 phase for it here (or add it as `not started` if the numbering demands a row) — explicitly out of scope for
implementation.

#### 4. §6 / §7 clarifications

**File**: `context/foundation/test-plan.md`

**Intent**: Prevent a future reader from reading the §7 "markdown render fidelity" exclusion as excluding the
security guard, and point the cookbook at the new spec.

**Contract**: In §7, clarify the markdown-fidelity exclusion (line 192) covers Shiki colors / HTML snapshots,
**not** the XSS security guard. Optionally add a §6.3 bullet pointing to `e2e/markdown-xss.spec.ts` as the
reference for render-security tests.

### Success Criteria:

#### Automated Verification:

- `test-plan.md` no longer contains the substring "and is untested" in the R#7 row, nor "unbuilt" applied to
  the AI surface for Phase 7: `rg -n "untested|unbuilt" context/foundation/test-plan.md` reviewed (remaining
  hits, if any, are unrelated to R#7/Phase 7).
- Doc still parses as the test-plan (tables intact): `rg -n "Phase 7|Markdown render XSS" context/foundation/test-plan.md`.

#### Manual Verification:

- §2 R#7 reads truthfully: existing+new guard registered, four live sources named, D.1 framed.
- §3 Phase 7 framing no longer claims the AI surface is unbuilt.
- D.2 ordering-integrity is present as a logged §2 row clearly marked not-implemented-here.
- §7 fidelity exclusion no longer reads as excluding the security guard.

**Implementation Note**: After Phase 2, the change is ready for the per-slice review gate
(`slice-review-gate`) → archive. The §3 Phase 7 Status flip to `complete` and any `roadmap`/Linear sync land
at archive, not here.

---

## Testing Strategy

### Unit Tests:

- None. This is a render-layer security property best observed end-to-end (the renderer is async RSC + client
  Shiki; a unit test on the pipeline would test react-markdown internals — the named anti-pattern).

### Integration Tests:

- None added. The token-API note-write path already has integration coverage
  (`src/__tests__/api-routes.integration.test.ts`); its body is stored verbatim and rendered by the same
  pipeline — convergence documented, not re-tested.

### Manual Testing Steps:

1. Temporarily add `rehypeRaw` to `REHYPE_PLUGINS` → run `pnpm test:e2e markdown-xss` → both tests fail on the
   inert-DOM assertions → revert.
2. Temporarily pass `urlTransform={(u) => u}` to `RenderMarkdown` → run again → the dangerous-href assertions
   fail → revert.
3. Confirm the suite is green after reverts.

## Performance Considerations

Negligible — two added E2E tests on the existing fresh-prod-server harness (port 3100). `retries: 2` already
covers the local GoTrue sign-up flake (lessons.md).

## Migration Notes

None. Removing the superseded `notes.spec.ts` test is a net coverage gain (the new spec is a strict superset).

## References

- Research: `context/changes/testing-markdown-xss-guard/research.md`
- Existing partial guard (to migrate): `e2e/notes.spec.ts:85-107`
- Import-path E2E pattern: `e2e/import-notes.spec.ts:33-50`
- Pipeline + urlTransform: `src/components/markdown/markdown-plugins.ts`, `render-markdown.tsx:8`,
  `node_modules/react-markdown/lib/index.js:421-444`
- Helpers: `e2e/helpers.ts` (`signUp`, `uniqueEmail`, `fillEditor`)
- Backport source: `context/changes/test-suite-audit/test-suite-audit.md` §D

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: XSS render-battery spec (user path + import path)

#### Automated

- [x] 1.1 Lint passes on changed files (`pnpm exec eslint e2e/markdown-xss.spec.ts e2e/notes.spec.ts`) — c7403ec
- [x] 1.2 Typecheck passes (`pnpm typecheck`) — c7403ec
- [x] 1.3 New spec passes (`pnpm test:e2e markdown-xss`) — c7403ec
- [x] 1.4 Notes spec still passes after removal (`pnpm test:e2e notes`) — c7403ec

#### Manual

- [x] 1.5 Both tests fail with `rehype-raw` temporarily added (assertions proven real), then reverted — c7403ec
- [x] 1.6 Dangerous-href assertion fails with a permissive `urlTransform` temporarily set, then reverted — c7403ec
- [x] 1.7 `e2e/notes.spec.ts:85` test removed; no other spec references it — c7403ec

### Phase 2: test-plan.md corrections + backport

#### Automated

- [x] 2.1 No stale "untested"/"unbuilt" framing remains on R#7/Phase 7 (`rg` reviewed)
- [x] 2.2 Test-plan tables intact (`rg "Phase 7|Markdown render XSS"`)

#### Manual

- [x] 2.3 §2 R#7 reads truthfully (guard registered, four sources, D.1 framed)
- [x] 2.4 §3 Phase 7 framing no longer claims AI surface unbuilt
- [x] 2.5 D.2 ordering-integrity logged as a §2 row marked not-implemented-here
- [x] 2.6 §7 fidelity exclusion clarified to not exclude the security guard
