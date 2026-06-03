# Capture a Note with Code (S-01) — Plan Brief

> Full plan: `context/changes/capture-note-with-code/plan.md`
> Research: `context/changes/capture-note-with-code/research.md`

## What & Why

Build note CRUD and its UI — the recall loop's content-creation layer. A user writes markdown notes with syntax-highlighted code, the first thing the whole product (topic checks, recall loop, dashboard) sits on. This is the repo's first mutations and first product UI.

## Starting Point

F-02 (committed `1598348`) already shipped the `notes` table with RLS scoped by `auth.uid()`, typed Supabase clients, and a `getNotes()` read helper. No mutations, no notes UI, and no editor/markdown/highlight dependencies exist yet.

## Desired End State

From `(protected)/notes`, a signed-in user can list their notes, create one in a side-by-side live-preview markdown editor, view it with Shiki-highlighted code blocks (light/dark), edit it, and delete it behind a confirm dialog (its topic checks cascade away at the DB). All quality gates green, including a new CRUD E2E.

## Key Decisions Made

| Decision        | Choice                                                | Why (1 sentence)                                                                  | Source   |
| --------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Editor library  | `@uiw/react-codemirror` + `@codemirror/lang-markdown` | Maintained React-19 wrapper; `language-data` gives free nested-fence highlighting | Research |
| Highlighter     | Shiki via `MarkdownAsync` + `@shikijs/rehype`         | Editor-accurate output + dual light/dark for a dev-facing tool                    | Plan     |
| Render location | Server Component (`MarkdownAsync`)                    | Zero highlighting bytes shipped to client                                         | Research |
| Editor ↔ form   | Composed alongside, controlled value                  | Keeps the `ssr:false` lazy editor out of the shared form-hook registry            | Plan     |
| Preview layout  | Side-by-side ≥md, Write/Preview tabs below            | Honors FR-007 on desktop and the ~360px NFR on mobile                             | Plan     |
| Delete UX       | shadcn AlertDialog                                    | Accessible, on-brand, reusable for S-02 topic-check deletes                       | Plan     |
| Post-mutation   | `revalidatePath` + `redirect` in the action           | Matches F-01 redirect-from-action; server stays source of truth                   | Plan     |
| Title           | Required, 1–200 chars (DB col stays nullable)         | Clean list UI; every note has a label                                             | Plan     |
| Write wrapper   | Reuse `runTableQuery` via `.select().single()`        | Avoids its null-data throw without a second wrapper                               | Research |

## Scope

**In scope:** note create/view/edit/delete/list (FR-007–011); markdown editor with live preview; Shiki-highlighted RSC render; AlertDialog delete; CRUD E2E.

**Out of scope:** topic checks (S-02), recall loop (S-03), dashboard (S-04), account deletion (S-05); image upload, autosave/drafts, search, tags.

## Architecture / Approach

New code in `src/features/notes/` (`schemas.ts`, `run-note-action.ts`, `actions/{create,update,delete}-note.ts`, `note-editor.tsx`, `note-form.tsx`, `render-markdown.tsx`, `delete-note-button.tsx`, extended `queries.ts`) and routes in `src/app/(protected)/notes/{,/new,/[id],/[id]/edit}`. Reads are Server Components calling typed helpers; the editor + forms are lazy `'use client'` islands. Mutations mirror the auth `'use server'` → validate → `ActionResultT` pattern, write through `runTableQuery` with `.select().single()`, then `revalidatePath` + `redirect`.

## Phases at a Glance

| Phase           | What it delivers                                                                | Key risk                                                                     |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Write layer  | Deps, note schema, 3 mutation actions + `getNote`, shadcn textarea/alert-dialog | Shiki tri-package version lockstep; pnpm `allowBuilds` for new build scripts |
| 2. Read UI      | Notes list + Shiki-highlighted detail (RSC)                                     | `MarkdownAsync`/async-RSC boundary; dual-theme CSS wiring                    |
| 3. Write UI     | Lazy CodeMirror editor + responsive live-preview create/edit                    | Editor `ssr:false` + code-splitting; mobile tab layout                       |
| 4. Delete + E2E | AlertDialog delete + full CRUD/highlight Playwright spec                        | Asserting "highlighted, not plain text" robustly                             |

**Prerequisites:** F-02 merged (done). **Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- **Shiki peer-pin**: `shiki` / `@shikijs/rehype` / `@shikijs/types` must resolve to one version or pnpm 11 errors — pin all three together.
- **F-02 is under review by a parallel agent.** Plan builds on its committed schema contract; if review changes column names/types, Phase 1's schema/actions need a touch-up (low risk — schema is committed and stable).
- **Client preview vs server render**: the live-preview pane (client) won't run Shiki (kept server-only); preview highlighting is plain/light, the saved detail view is the authoritative highlighted render. Acceptable per FR-007 (preview is for structure, not final fidelity).

## Success Criteria (Summary)

- A user can create → view (with highlighted code) → edit → delete a note end-to-end without errors.
- Code blocks render with real syntax highlighting (token meaning preserved), not flat text — the product-premise NFR.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` all green, including `notes.spec.ts`.
