# Shiki Language Source of Truth Implementation Plan

## Overview

Constrain the Shiki markdown highlighter to a curated, single-source-of-truth language set instead of loading all ~200 bundled grammars, and make off-list fences degrade to plain text. A boot/memory perf fix for every markdown render path, plus a correctness guard against unknown fences.

## Current State Analysis

`src/components/markdown/render-markdown.tsx` constructs `@shikijs/rehype` with only `themes` and no `langs`. Inside `@shikijs/rehype@4.1.0`, the default export computes `langs = options.langs || Object.keys(bundledLanguages)` and feeds it to `getSingletonHighlighter` — so the shared, process-global highlighter loads **every grammar Shiki ships**.

- **Single construction site:** `render-markdown.tsx` is the only place Shiki/`@shikijs/rehype` is instantiated (grep-confirmed). The client live preview (`markdown-preview.tsx`) uses plain `react-markdown` with no Shiki — out of scope.
- **Four consumers, zero per-consumer work:** `notes/[id]/page.tsx`, `subjects/[id]/page.tsx`, `review/page.tsx`, and `topic-checks/topic-checks-section.tsx` all render through `RenderMarkdown`; fixing the one component fixes all of them.
- **Curated list already exists:** `src/components/markdown/code-languages.ts` exports `CODE_LANGUAGES` (20 entries) — the languages the code-block picker offers. `text` (plain passthrough) and `md` (alias for `markdown`) are both present.
- **Regression guard exists:** `e2e/notes.spec.ts` asserts `pre.shiki` is visible and counts `span[style*="--shiki"]` tokens (>3) on the detail view.

### Key Discoveries:

- `@shikijs/rehype@4.1.0` `dist/index.mjs`: `const langs = options.langs || Object.keys(bundledLanguages)` — the unconstrained default.
- `dist/core-*.mjs:33,75-101`: the `lazy` option loads an unloaded fence's grammar on demand via `highlighter.loadLanguage(lang)`, falling back to `fallbackLanguage` on failure.
- Benchmarked (real Python doc, 75 fences, fresh process per config): boot **3297ms → 141ms** (curated 20) / **27ms** (`[]`+lazy); boot heap **129MB → 37MB / 22MB**; tokenize **flat** (~140ms) across all three → a boot/memory cost, not per-render. 0 fallbacks (`py` resolves as a `python` alias).

## Desired End State

`RenderMarkdown` loads only the curated language set on boot, lazy-loads anything off-list on demand, and renders an unknown fence as plain text without throwing. The picker (`CODE_LANGUAGES`) and the highlighter's `langs` derive from one array, so they cannot drift. Verified by: existing highlight E2E still green, plus a new assertion that an off-list fence renders as plain text; `pnpm typecheck`/`lint`/`build` green.

## What We're NOT Doing

- No per-user / dynamic language selection (rejected in `change.md` — fights the process-global singleton; belongs to a future user-settings slice).
- No change to the client live preview (`markdown-preview.tsx`) — it has no Shiki.
- No new languages added to `CODE_LANGUAGES` in this change (curation is a separate decision).
- No changes to the four consumer pages.

## Implementation Approach

Single phase, two files. Derive `SHIKI_LANGS` from `CODE_LANGUAGES` (the single source of truth), pass it plus `lazy: true` and `fallbackLanguage: 'text'` to the rehype plugin, then extend the existing notes E2E with one off-list-fence assertion.

## Phase 1: Constrain Shiki to the curated language set

### Overview

Add the derived language list and wire it into the highlighter with lazy loading and a plain-text fallback; guard the new fallback behavior with an E2E assertion.

### Changes Required:

#### 1. Derive the language list

**File**: `src/components/markdown/code-languages.ts`

**Intent**: Expose the picker's language ids as the highlighter's load list, so the set you can insert and the set that highlights are one source.

**Contract**: New named export `SHIKI_LANGS: readonly string[] = CODE_LANGUAGES.map((l) => l.value)`. No change to `CODE_LANGUAGES` itself.

#### 2. Constrain the highlighter

**File**: `src/components/markdown/render-markdown.tsx`

**Intent**: Stop loading all ~200 grammars; preload the curated 20, lazy-load anything off-list, and degrade unknown fences to plain text instead of throwing.

**Contract**: The `rehypeShiki` options object gains `langs: SHIKI_LANGS`, `lazy: true`, and `fallbackLanguage: 'text'` alongside the existing dual `themes`. Import `SHIKI_LANGS` from `./code-languages`. Update the component's header comment to note the curated-langs + lazy + fallback behavior (do not remove existing comments).

#### 3. Guard the fallback behavior

**File**: `e2e/notes.spec.ts`

**Intent**: Lock in that an _unknown_ fence language degrades to plain text without throwing. Under `lazy: true` a valid off-list language (e.g. `kotlin`) would lazy-load and highlight — so the `fallbackLanguage` path only fires for a language Shiki has no grammar for. The test must therefore use a bogus token, not a real off-list language. The existing assertion continues to prove on-list highlighting works.

**Contract**: Within (or beside) the existing CRUD spec, create the **bogus**-fence note as its **own separate note** (not mixed with the on-list block) — its body contains a fenced block in a bogus language token Shiki cannot resolve (e.g. ` ```xyzzy `). Isolation matters: a fallback-to-`text` block still renders as `<pre class="shiki">`, just with no `--shiki` token spans, so a global `pre.shiki span[style*="--shiki"]` selector would also match the on-list block's tokens. Scope the assertions per-note: on the bogus note's detail view assert `pre.shiki` is visible (no error/throw) **and** `pre.shiki span[style*="--shiki"]` count is **0** (plain, fallback fired); the existing on-list assertion (`python` block → `pre.shiki` + `span[style*="--shiki"]` count > 3) stays on its own note and continues to prove highlighting works. Two notes, two independent assertions — no cross-contamination. Reuse `e2e/helpers.ts` (`signUp`, `fillEditor`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`
- E2E passes incl. the new off-list-fence assertion: `pnpm test:e2e` (local Supabase stack up)

#### Manual Verification:

- A note/subject with `python`/`sql`/`bash` fences still renders highlighted on the detail and subject views.
- A bogus fence language (e.g. ` ```xyzzy `) renders as plain (uncolored) text, no error page. (A valid off-list language like `kotlin` lazy-loads and highlights — expected under `lazy`.)
- Cold-start feels faster on the first markdown render after a fresh `pnpm start` (subjectively; the benchmark already quantifies it).

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before archiving.

---

## Testing Strategy

### Unit Tests:

- None — `RenderMarkdown` is an async server component invoking heavy Shiki; the project convention is E2E for rendering (confirmed in questioning).

### Integration / E2E Tests:

- Extend `e2e/notes.spec.ts`: on-list fence stays highlighted (existing assertion); a bogus fence language renders plain without error (new assertion — the `fallbackLanguage` path).

### Manual Testing Steps:

1. `pnpm build && pnpm start` (or the e2e harness), open a subject with `python` fences → highlighted.
2. Create a note with a bogus ` ```xyzzy ` block → renders as plain text, no error. (A real off-list language such as `kotlin` will lazy-load and highlight — the intended `lazy` behavior.)

## Performance Considerations

The whole point: boot drops from ~3.3s to ~0.14s and boot heap from ~129MB to ~37MB on the first markdown render per server process (benchmarked). Per-render tokenization is unchanged. `lazy: true` adds a one-time, few-ms grammar load the first time an off-list language actually appears.

## References

- Design + benchmark: `context/changes/shiki-lang-source-of-truth/change.md`
- Lesson: `context/foundation/lessons.md` — "Measure perf in a production build…" (dev-vs-prod + ~200-grammar boot cost)
- Plugin internals: `node_modules/.pnpm/@shikijs+rehype@4.1.0/node_modules/@shikijs/rehype/dist/{index,core-*}.mjs`
- Existing highlight assertion: `e2e/notes.spec.ts:33-35`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Constrain Shiki to the curated language set

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 826efaa
- [x] 1.2 Linting passes: `pnpm lint` — 826efaa
- [x] 1.3 Production build passes: `pnpm build` — 826efaa
- [x] 1.4 E2E passes incl. the new off-list-fence assertion: `pnpm test:e2e`

#### Manual

- [ ] 1.5 On-list fences (`python`/`sql`/`bash`) still render highlighted on detail + subject views
- [ ] 1.6 Bogus fence language renders as plain text, no error page
- [ ] 1.7 Cold-start first-render feels faster after a fresh `pnpm start`
