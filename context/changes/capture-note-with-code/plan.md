# Capture a Note with Code (S-01) Implementation Plan

## Overview

Build note CRUD and its UI on top of F-02's persistence floor: the repo's **first mutation Server Actions** and **first product UI**. A user can create a note (title + markdown body) in a side-by-side live-preview editor, view it rendered with code-block syntax highlighting, edit it, delete it (its topic checks cascade at the DB), and see a list of all their notes. Implements FR-007–011 and the US-01 note-creation half.

## Current State Analysis

From `context/changes/capture-note-with-code/research.md` (internal sweep + Context7 + exa):

- **Data floor exists** (F-02, committed `1598348`): `notes` table with RLS scoped by `(select auth.uid())`; `user_id` is `not null default auth.uid()` and `with check`-guarded; `title text` (nullable at DB), `content text not null default ''`, `created_at`/`updated_at`. Typed clients (`createServerClient<Database>` / `createBrowserClient<Database>`). `topic_checks.note_id → notes(id) on delete cascade` already in place.
- **Read helper exists**: `src/features/notes/queries.ts:12-17` — `getNotes(client?)`, RLS-scoped, injectable client. `src/features/notes/types.ts:4` — `NoteT` re-exported from `Database`.
- **Read wrapper, not write-safe as-is**: `src/lib/supabase/run-table-query.ts:11-27` throws when `data === null` (line 25). A `delete` (or insert/update without `.select()`) returns null data → must use `.select()` on writes or a sibling write wrapper.
- **Mutation pattern to mirror** (auth): `src/types/action.ts:2` (`ActionResultT`), `src/features/auth/validate.ts:4-14` (`validateInput`), `src/features/auth/run-auth-action.ts:13-26` (wrapper, kept out of `'use server'`), `src/features/auth/actions/*.ts` (`'use server'`, return-on-fail / redirect-on-success), `src/features/auth/schemas.ts` (per-field + composed Zod + inferred `*T`).
- **UI/routing pattern to mirror**: `src/app/(protected)/layout.tsx:1-17` (server gate via `getUser` + `redirect`); `src/app/(auth-pages)/sign-up/page.tsx:1-65` (canonical `useAppForm` client form: `defaultValues`, `form.AppField` + Zod `validators`, `form.Subscribe` for `isSubmitting`, form-level error `useState`). `src/components/forms/hooks/form-hooks.ts` registers field components.
- **No editor/markdown/highlight deps installed** (`package.json:21-54`). shadcn installed: `button, card, input, label` only.
- **"Firsts" in this repo**: first mutation action, first `revalidatePath`, first `redirect` after a write, first dynamic route (`[id]`), first shadcn `dialog`, first 3rd-party rendering/editor deps, first highlight CSS path.

## Desired End State

A signed-in user, from `(protected)/notes`, can:

- see a reverse-chronological list of their notes (title + timestamp), or an empty state with a "New note" CTA;
- open `/notes/new`, write markdown with a CodeMirror editor showing a **live preview** (side-by-side ≥md, Write/Preview tabs below md), and save — landing on the note's detail page;
- view `/notes/[id]` with markdown rendered and code blocks **syntax-highlighted via Shiki** (JS/TS/Python/Go/Rust), light/dark following the app theme;
- edit via `/notes/[id]/edit` (same editor, pre-filled) and save;
- delete from the detail page behind a shadcn **AlertDialog** confirm, landing back on the list; the note's topic checks are gone too (DB cascade).

Verify: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` all green, including a new `notes.spec.ts`.

### Key Discoveries:

- **`user_id` must never be sent by the client** — DB default `auth.uid()` + RLS `with check` set and guard it. The create action inserts `{title, content}` only (research §Architecture Insights).
- **FR-010 cascade is free** — the `topic_checks.note_id` FK `on delete cascade` already deletes attached checks; the delete action only removes the note row.
- **`runTableQuery` throws on null data** (`run-table-query.ts:25`) — writes go through `.select().single()` so a row is returned, reusing the existing wrapper rather than adding a second one.
- **Shiki + react-markdown is async-only** — react-markdown's default `<Markdown>` runs `processSync`; `@shikijs/rehype` is async, so the render view uses **`MarkdownAsync`** (react-markdown v10, RSC-safe). `@shikijs/rehype`, `shiki`, `@shikijs/types` peer-pin to the **same exact version** or pnpm errors.
- **CodeMirror needs `ssr:false`** — touches `window`/`document`; `next/dynamic({ ssr:false })` is legal only inside a `'use client'` component (Next 16). `markdown({ base: markdownLanguage, codeLanguages: languages })` gives free nested-fence highlighting via `@codemirror/language-data`'s lazy imports.

## What We're NOT Doing

- **No topic checks** (FR-012–015) — that's S-02. Delete still cascades them at the DB, but no topic-check UI/actions here.
- **No recall loop / scheduling** (S-03), **no dashboard** (S-04), **no account deletion** (S-05).
- **No image upload, no attachments, no autosave/drafts** — explicit save only.
- **No full-text search or tags** (tags are v1.1, parked).
- **No hosted `db push`** — schema already exists from F-02; no migration in this slice.
- **No Shiki→client rendering** — render view stays a Server Component; zero highlighting bytes shipped to the client.

## Implementation Approach

Bottom-up, each phase independently verifiable (the F-02 rhythm): write layer first (schema + actions, no UI), then the read UI (list + highlighted detail), then the write UI (editor + forms), then delete + an end-to-end test. Mutations reuse `runTableQuery` via `.select().single()` and a thin notes-action wrapper that mirrors `runAuthAction`. All new code is born in `src/features/notes/` and `src/app/(protected)/notes/`; reusable form/editor primitives go in `src/components/`.

## Critical Implementation Details

- **Shiki version lockstep.** `shiki`, `@shikijs/rehype`, and `@shikijs/types` must resolve to one identical version (e.g. all `4.x`), or pnpm 11 fails on the peer constraint. Pin all three together.
- **`MarkdownAsync` boundary.** The render component is an `async` Server Component returning `<MarkdownAsync rehypePlugins={[[rehypeShiki, {themes:{light,dark}}]]} remarkPlugins={[remarkGfm]}>`. It must not be imported into a client component. Shiki dual-theme emits CSS variables; a small global rule selects light/dark off the existing `.dark` class in `globals.css`.
- **Editor lazy-load boundary.** The CodeMirror editor lives in a `'use client'` wrapper that does `dynamic(() => import('@uiw/react-codemirror'), { ssr:false, loading: <skeleton> })`. The new/edit **pages** may stay server components that render this client editor island; form state (`useAppForm`) lives in the client island, with the editor's value synced via a controlled `value`/`onChange` (not registered into the shared form hook).
- **Write returns a row.** Every mutation thunk ends in `.select().single()` so `runTableQuery` gets non-null data (it throws otherwise). `createNote`/`updateNote` use the returned `id` for the post-write `redirect`.

## Phase 1: Write layer — deps, schema, actions

### Overview

Install the editor/render/highlight dependencies and the two shadcn components, define the note Zod schema, add a notes-action wrapper + three mutation actions, and a `getNote(id)` read helper. No UI yet — verified by typecheck/lint/unit.

### Changes Required:

#### 1. Dependencies

**File**: `package.json` (via `pnpm add`)

**Intent**: Add the editor, markdown-render, and highlighter stacks resolved in research.

**Contract**: runtime deps — `@uiw/react-codemirror`, `codemirror`, `@codemirror/lang-markdown`, `@codemirror/language-data`, `react-markdown`, `remark-gfm`, `shiki`, `@shikijs/rehype` (the last two + transitive `@shikijs/types` pinned to one version). If pnpm reports an ignored build script (e.g. for a transitive dep), add an explicit boolean to `allowBuilds` in `pnpm-workspace.yaml` per AGENTS.md.

#### 2. shadcn components

**File**: `src/components/ui/textarea.tsx`, `src/components/ui/alert-dialog.tsx` (via `pnpm dlx shadcn@latest add textarea alert-dialog`)

**Intent**: Textarea (mobile/fallback body input + future topic-check inputs) and AlertDialog (delete confirm).

**Contract**: standard shadcn `radix-nova` output; AlertDialog is the repo's first dialog.

#### 3. Note schema

**File**: `src/features/notes/schemas.ts` (new)

**Intent**: Single source of validation for note create/update, reused by client field validators and server action parsing.

**Contract**: `titleSchema` (`z.string().trim().min(1).max(200)`), `contentSchema` (`z.string()` — body may be empty), composed `noteInputSchema = z.object({ title, content })`, inferred `NoteInputT`. Mirrors `src/features/auth/schemas.ts` shape.

#### 4. Notes-action wrapper

**File**: `src/features/notes/run-note-action.ts` (new)

**Intent**: Table analogue of `runAuthAction` — validate input, get the server client, run a PostgREST write through `runTableQuery`, normalize to `ActionResultT` (or return the typed row to the caller for the redirect target). Kept out of a `'use server'` file, like `runAuthAction`.

**Contract**: a helper that takes `(schema, input, call)` where `call(client, data)` performs the write and returns `{ data, error }` (ending in `.select().single()`); returns either `ActionResultT` or a `{ success: true; data: NoteT }` discriminant so create/update can read `data.id`. Reuses `runTableQuery` for the data/error normalization.

#### 5. Mutation actions

**File**: `src/features/notes/actions/create-note.ts`, `update-note.ts`, `delete-note.ts` (new, each `'use server'`)

**Intent**: The repo's first mutations. Create inserts `{title, content}` (never `user_id`); update sets `{title, content, updated_at: now()}` for a given `id`; delete removes the note by `id` (RLS scopes all three to the owner; cascade handles topic checks).

**Contract**: each calls `runNoteAction`/`runTableQuery`. On success: `revalidatePath('/notes')` (+ `revalidatePath('/notes/[id]','page')` as needed) then `redirect` — create/update → `/notes/[newId]`, delete → `/notes`. On failure: return `ActionResultT`. First `revalidatePath`/post-write `redirect` in the repo.

#### 6. Single-note read helper

**File**: `src/features/notes/queries.ts` (extend)

**Intent**: Fetch one note for detail/edit pages.

**Contract**: `getNote(id: string, client?: SupabaseClient<Database>): Promise<NoteT | undefined>` — `.eq('id', id).maybeSingle()` (RLS already scopes to owner; returns `undefined` when not found / not owned, so pages can `notFound()`). Note: `maybeSingle` returns `{data:null}` without error for no-match, so it must **not** go through the null-throwing `runTableQuery` — handle its `{data,error}` directly or via a maybe-variant.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes with new schema/actions/helper
- `pnpm lint` passes
- `pnpm test` passes (any unit coverage for schema/wrapper)
- `pnpm install` clean — no `ERR_PNPM_IGNORED_BUILDS`

#### Manual Verification:

- `pnpm build` succeeds (deps resolve, no SSR import of the editor)
- shadcn `textarea` + `alert-dialog` render in isolation

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Read UI — list + highlighted detail

### Overview

Two Server Components: the notes list (reuses `getNotes`) and the note detail view rendering markdown with Shiki-highlighted code. Delivers FR-008 and FR-011.

### Changes Required:

#### 1. Notes list page

**File**: `src/app/(protected)/notes/page.tsx` (new, server component)

**Intent**: List the user's notes reverse-chronologically; empty state with a "New note" CTA.

**Contract**: `async` page calling `getNotes()`; renders a list of cards/links to `/notes/[id]` (title + relative `created_at`); empty-state block linking `/notes/new`. Inherits the `(protected)` auth gate.

#### 2. Markdown render component

**File**: `src/features/notes/render-markdown.tsx` (new, server component)

**Intent**: Reusable async RSC that renders a markdown string with GFM + Shiki dual-theme highlighting.

**Contract**: `async function RenderMarkdown({ content }: { content: string })` returning `<MarkdownAsync remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' } }]]}>{content}</MarkdownAsync>`. Not importable from a client component.

#### 3. Note detail page

**File**: `src/app/(protected)/notes/[id]/page.tsx` (new, server component — first dynamic route)

**Intent**: Show one note: title, timestamps, rendered body; links to edit; hosts the delete control (Phase 4).

**Contract**: `async` page reading `params.id` (Next 16 async params), calling `getNote(id)`; `notFound()` when undefined; renders `<RenderMarkdown content={note.content} />`. Edit link to `/notes/[id]/edit`.

#### 4. Code-highlight theme CSS

**File**: `src/app/globals.css` (extend)

**Intent**: Make Shiki's dual-theme output follow the app's light/dark.

**Contract**: a small rule mapping Shiki's CSS-variable dual-theme output to `.dark` (Shiki emits `--shiki-light`/`--shiki-dark` vars; select the dark values under the existing `.dark` class). No token renames.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
- Detail route renders server-side (no client error)

#### Manual Verification:

- A note with ` ```ts ` / ` ```python ` blocks renders with distinct keyword/string/comment/type colors (not flat text) — NFR check
- Light/dark toggle recolors code blocks correctly
- List shows newest-first; empty state shows the CTA
- `/notes/<unknown-id>` shows not-found, not another user's note

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Write UI — editor + create/edit

### Overview

A lazy `'use client'` CodeMirror editor with responsive live preview, and the new/edit pages wiring it to the create/update actions. Delivers FR-007 and FR-009.

### Changes Required:

#### 1. Lazy CodeMirror editor island

**File**: `src/features/notes/note-editor.tsx` (new, `'use client'`)

**Intent**: Markdown editing surface with nested code-fence highlighting, lazy-loaded off the main bundle.

**Contract**: `'use client'` component doing `const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr:false, loading: <skeleton> })`; configured with `markdown({ base: markdownLanguage, codeLanguages: languages })`; controlled `value`/`onChange` props. No dependency on the shared form hook.

#### 2. Note form (client)

**File**: `src/features/notes/note-form.tsx` (new, `'use client'`)

**Intent**: The create/edit form: title via `useAppField`, body via the editor island, live preview pane, responsive layout, submit wiring.

**Contract**: `useAppForm` with `defaultValues` (`{title, content}`, pre-filled for edit); title is a `form.AppField` + `titleSchema` validator; body value held in form state and fed to `<NoteEditor>` (controlled) and to a preview pane rendering markdown. Layout: side-by-side editor|preview at `md:` and up; **Write/Preview tabs** below `md`. On submit: call `createNote`/`updateNote`; set form-level error on failure (success redirects server-side). Mirrors `sign-up/page.tsx` wiring (`form.Subscribe` for `isSubmitting`, `FormError`).

- **Preview in the client form** can't use the async RSC `RenderMarkdown`; use a client-side markdown render (react-markdown default `<Markdown>` + `remark-gfm`, highlighting optional/plain in preview) — the authoritative Shiki render is the saved detail view. (Keeps the editor island self-contained; avoids shipping Shiki to the client.)

#### 3. New + edit pages

**File**: `src/app/(protected)/notes/new/page.tsx`, `src/app/(protected)/notes/[id]/edit/page.tsx` (new)

**Intent**: Host the note form for create and edit.

**Contract**: `new/page.tsx` renders `<NoteForm action={createNote} />`. `edit/page.tsx` is an `async` server component that `getNote(id)` (→ `notFound()` if absent) and renders `<NoteForm action={updateNote} note={note} />`. Both inside `(protected)`.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
- Editor chunk is code-split (not in the initial/shared bundle) — confirm in build output

#### Manual Verification:

- Editor loads on `/notes/new`; typing markdown updates the live preview
- ≥md shows side-by-side; ~360px shows Write/Preview tabs, both usable
- Create saves and lands on the new note's detail (highlighted)
- Edit pre-fills, saves, reflects changes on detail
- Empty/whitespace title is blocked with a field error; >200 chars blocked

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Delete + end-to-end test

### Overview

AlertDialog-confirmed delete (FR-010) and a Playwright spec covering the full CRUD path plus the highlighting guarantee.

### Changes Required:

#### 1. Delete control

**File**: `src/features/notes/delete-note-button.tsx` (new, `'use client'`)

**Intent**: A destructive button on the detail page that confirms via AlertDialog before firing `deleteNote`.

**Contract**: `'use client'` component using shadcn `AlertDialog`; on confirm, calls `deleteNote(id)` (server action) — success redirects to `/notes` server-side. Rendered by the detail page.

#### 2. CRUD E2E spec

**File**: `e2e/notes.spec.ts` (new, sibling of `auth.spec.ts`/`isolation.spec.ts`)

**Intent**: Commit the S-01 acceptance path as an executable test.

**Contract**: sign up a fresh account via the real UI (per `lessons.md` — drive auth through UI), then: create a note with a ` ```ts ` code block → assert it appears in the list → open detail → assert the code renders as highlighted tokens (e.g. `.shiki`/token spans present, not a plain `<pre>` of text) → edit the title → assert the change → delete via the AlertDialog → assert it's gone from the list. Reuse the existing Playwright config (system Chrome, production build, local stack). Confirm the server is bound by PID/port before trusting the run (per `lessons.md`).

### Success Criteria:

#### Automated Verification:

- `pnpm test:e2e` passes including `notes.spec.ts`
- `auth.spec.ts` and `isolation.spec.ts` still green (no regression)
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass

#### Manual Verification:

- Delete shows the AlertDialog; cancel aborts, confirm removes the note and returns to the list
- Deleting a note that had topic checks (seed one via SQL/Studio) removes them too — DB cascade confirmed
- Server confirmed bound by PID/port before trusting the E2E run (per `lessons.md`)

**Implementation Note**: Final phase — confirm all four phases' automated + manual criteria before `/10x-impl-review` and `/10x-archive`.

---

## Testing Strategy

### Unit Tests:

- `noteInputSchema` validation (title min/max/trim, content optional)
- `run-note-action` error normalization + the row-return discriminant (optional)

### Integration / E2E Tests:

- `notes.spec.ts` — full CRUD + highlight assertion (the core deliverable)
- No regression in `auth.spec.ts` / `isolation.spec.ts`

### Manual Testing Steps:

1. `supabase start` + `pnpm build && pnpm start` (production build, per E2E config)
2. Sign in, create a note with multi-language code blocks, verify highlighting + light/dark
3. Resize to ~360px, verify Write/Preview tabs
4. Edit, then delete via AlertDialog; verify list updates and cascade

## Performance Considerations

- Editor (`@uiw/react-codemirror`, ~150KB) lazy-loaded via `next/dynamic({ssr:false})` so it ships only on `/notes/new` + `/notes/[id]/edit`, never on list/detail.
- Shiki runs server-side only (`MarkdownAsync` in an RSC) — zero highlighting bytes to the client; `@codemirror/language-data` lazy-imports per-language grammars on demand.
- `revalidatePath` keeps the list/detail fresh after writes without client refetch logic.

## Migration Notes

- No schema migration — `notes` already exists from F-02. This slice only adds app code + deps.

## References

- Research (internal + Context7 + exa): `context/changes/capture-note-with-code/research.md`
- F-02 schema/contract this builds on: `context/changes/persistence-and-isolation/plan.md`
- Read helper / wrapper: `src/features/notes/queries.ts:12-17`, `src/lib/supabase/run-table-query.ts:11-27`
- Action/form patterns to mirror: `src/features/auth/run-auth-action.ts:13-26`, `src/app/(auth-pages)/sign-up/page.tsx:1-65`
- E2E harness to mirror: `e2e/auth.spec.ts`, `e2e/isolation.spec.ts`
- Standing lessons: `context/foundation/lessons.md` (server bound by PID/port; UI auth + programmatic data ops)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Write layer — deps, schema, actions

#### Automated

- [x] 1.1 `pnpm typecheck` passes with new schema/actions/helper
- [x] 1.2 `pnpm lint` passes
- [x] 1.3 `pnpm test` passes (schema/wrapper coverage)
- [x] 1.4 `pnpm install` clean — no `ERR_PNPM_IGNORED_BUILDS`

#### Manual

- [ ] 1.5 `pnpm build` succeeds (no SSR import of the editor)
- [ ] 1.6 shadcn `textarea` + `alert-dialog` render in isolation

### Phase 2: Read UI — list + highlighted detail

#### Automated

- [ ] 2.1 `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
- [ ] 2.2 Detail route renders server-side (no client error)

#### Manual

- [ ] 2.3 ts/python code blocks render with distinct token colors (NFR)
- [ ] 2.4 Light/dark recolors code blocks correctly
- [ ] 2.5 List newest-first; empty state shows CTA
- [ ] 2.6 `/notes/<unknown-id>` shows not-found, not another user's note

### Phase 3: Write UI — editor + create/edit

#### Automated

- [ ] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
- [ ] 3.2 Editor chunk is code-split (not in initial/shared bundle)

#### Manual

- [ ] 3.3 Editor loads on `/notes/new`; live preview updates while typing
- [ ] 3.4 Side-by-side ≥md; Write/Preview tabs at ~360px, both usable
- [ ] 3.5 Create saves and lands on the new note's highlighted detail
- [ ] 3.6 Edit pre-fills, saves, reflects on detail
- [ ] 3.7 Empty/whitespace title blocked; >200 chars blocked

### Phase 4: Delete + end-to-end test

#### Automated

- [ ] 4.1 `pnpm test:e2e` passes including `notes.spec.ts`
- [ ] 4.2 `auth.spec.ts` and `isolation.spec.ts` still green
- [ ] 4.3 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass

#### Manual

- [ ] 4.4 AlertDialog: cancel aborts, confirm removes note → returns to list
- [ ] 4.5 Deleting a note with topic checks removes them too (DB cascade)
- [ ] 4.6 Server confirmed bound by PID/port before trusting the E2E run
