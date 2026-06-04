---
change_id: shiki-lang-source-of-truth
title: Single source of truth for code-block + Shiki languages, with lazy loading
status: implementing
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

Perf + correctness slice for markdown code highlighting. Born from a brainstorm on the subjects view; carved off as its own change because it's independent of the view/edit and sidebar-nav slices.

**Problem.** `RenderMarkdown` (`src/components/markdown/render-markdown.tsx`) passes no `langs` to `@shikijs/rehype`, so it falls through to `Object.keys(bundledLanguages)` — loading **all ~200 grammars** into the shared `getSingletonHighlighter`.

**Measured evidence** (real dogfood Python doc, 75 fences, fresh process per config):

| config                      | boot        | boot heap | tokenize (per-render) |
| --------------------------- | ----------- | --------- | --------------------- |
| all ~200 langs (status quo) | **3297 ms** | 129 MB    | 144 ms                |
| curated 20                  | 141 ms      | 37 MB     | 134 ms                |
| `[]` + lazy on-demand       | 27 ms       | 22 MB     | 140 ms                |

Tokenize is flat across all three → this is a **boot/memory** cost, not per-render. 0 fallbacks (`py` resolves as a `python` alias).

**Decisions (locked):**

- **Single source of truth:** `SHIKI_LANGS = CODE_LANGUAGES.map((l) => l.value)` in `src/components/markdown/code-languages.ts`. The picker (`CODE_LANGUAGES`) and the highlighter's `langs` derive from one array — they cannot drift. Add a language → it appears in the picker _and_ loads its grammar, in lockstep.
- **Config:** `RenderMarkdown` passes `{ langs: SHIKI_LANGS, lazy: true, fallbackLanguage: 'text' }`. Preload the curated 20 (fast common case); `lazy` loads anything off-list on demand; off-list/unknown fences degrade to plain text instead of throwing.
- **`text`** is already in `CODE_LANGUAGES` (Shiki built-in no-op passthrough) → fallback target exists for free. **`md`** is a Shiki alias for `markdown`.

**Scope guard:** only the Shiki/langs wiring. The subjects/notes view+edit consolidation (`inline-edit-notes-and-subjects`) and the docs-style sidebar nav (`subject-sidebar-nav`) are separate, sequenced changes.

**Verification:** typecheck/lint/build green; the subject + note detail pages still highlight `python`/`sql`/`bash`/etc.; an off-list fence renders as plain text without error. Lesson already captured in `context/foundation/lessons.md` (prod-vs-dev measurement + the ~200-grammar boot cost).
