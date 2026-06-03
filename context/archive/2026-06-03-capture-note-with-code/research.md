---
date: 2026-06-03 10:22:07 +0200
researcher: ex-Plant
git_commit: 33a38edb8b56017cc6e8aa27027bc0e9e0402376
branch: main
repository: 10x_devs
topic: 'S-01 capture-note-with-code — note CRUD + UI with code-block syntax highlighting'
tags: [research, codebase, notes, server-actions, markdown, codemirror, shiki, rehype-highlight]
status: complete
last_updated: 2026-06-03
last_updated_by: ex-Plant
---

# Research: S-01 capture-note-with-code

**Date**: 2026-06-03 10:22:07 +0200
**Researcher**: ex-Plant
**Git Commit**: 33a38ed
**Branch**: main
**Repository**: 10x_devs

## Research Question

What does the codebase already provide for S-01 (`capture-note-with-code`: create / view / edit / delete / list notes with markdown + code-block syntax highlighting, FR-007–011, US-01), and what external libraries should the editor + render view use? Two legs: **internal** (conventions to mirror — the first mutations + first product UI in the repo) and **external** (Context7 + exa — the roadmap's flagged unwired-library unknown: CodeMirror 6 editor, react-markdown render, highlighter).

## Summary

S-01 sits directly on top of F-02 (committed, `1598348`). The `notes` table, RLS, typed Supabase clients, and a typed read helper (`getNotes`) already exist. S-01 adds the repo's **first mutations** (create/update/delete Server Actions → first `revalidatePath`/`redirect`-after-mutation) and **all the product UI** (list, render-with-highlighting view, side-by-side markdown editor). Every convention it needs is already established by F-01/F-02 and should be mirrored, not reinvented:

- **Mutations** mirror the auth `'use server'` → `validateInput` → `ActionResultT` pattern, with a **table-aware action wrapper** analogous to `runAuthAction`. ⚠️ The existing `runTableQuery` read wrapper **cannot be reused verbatim for writes** — it throws on `data === null`, which a `delete` (or a write without `.select()`) produces.
- **UI** mirrors the `(protected)` route group + server-component-fetches-data + `useAppForm` client-form pattern. New routes: `/notes`, `/notes/new`, `/notes/[id]`, `/notes/[id]/edit` — the repo's **first dynamic routes**.
- **Editor** (FR-007 "plain markdown + side-by-side live preview"): `@uiw/react-codemirror` (maintained React-19-compatible wrapper) + `@codemirror/lang-markdown` with `@codemirror/language-data` for free nested-fence highlighting, lazy-loaded via `next/dynamic({ ssr:false })` inside a `'use client'` wrapper.
- **Render view** (FR-008, NFR token-meaning): `react-markdown@10` + `remark-gfm@4` in a **Server Component**. Highlighter is the one live decision for `/10x-plan` — see the recommendation and the **`processSync` trap** in §External.

**No editor/markdown/highlight dependency is installed yet** — package.json confirms it. This is the roadmap's named S-01 unknown; this research resolves the candidate set and pins versions.

## Detailed Findings

### Internal — what F-01/F-02 already established

#### Data layer (read) — exists; write layer is new

- `src/features/notes/queries.ts:12-17` — `getNotes(client?)`: typed, RLS-scoped (no manual `user_id` filter), injectable client, `order('created_at', desc)`. Use as-is for the list view.
- `src/features/notes/types.ts:4` — `NoteT = Database['public']['Tables']['notes']['Row']`. Re-export row types from the generated `Database`; don't hand-author.
- `src/lib/supabase/run-table-query.ts:11-27` — read wrapper. Takes an **injectable** `SupabaseClient<Database>` + a query thunk; returns typed rows or throws (`error.message`, original on `cause`). **⚠️ Throws when `data === null` (line 25)** — a mutation that returns no rows (delete, or insert/update without `.select()`) would hit this. S-01 either (a) forces writes through `.select().single()` so data is non-null, or (b) adds a sibling write wrapper that tolerates null data. Flag for plan.
- **Note table contract** (from F-02 migration / plan.md): `notes(id uuid pk, user_id uuid not null default auth.uid(), title text [nullable], content text not null default '', created_at, updated_at)`. `user_id` defaults to `auth.uid()` and RLS `with check` enforces ownership → **the create action must NOT send `user_id`**; the DB sets and guards it. `title` is nullable at the DB; the app schema can still require it (product choice for `/10x-plan`).
- FK cascade: `topic_checks.note_id → notes(id) on delete cascade` already exists → **FR-010 "delete note removes attached topic checks" is satisfied at the DB**; the delete action just deletes the note row.

#### Mutation pattern to mirror (auth)

- `src/types/action.ts:2` — `ActionResultT = { success: true } | { success: false; error: string }`.
- `src/features/auth/validate.ts:4-14` — `validateInput(schema, input)` → discriminated `{success,data}|{success,error}`; flattens first Zod issue.
- `src/features/auth/run-auth-action.ts:13-26` — wrapper: validate → create client → run call → normalize `{error}` → `ActionResultT`. Deliberately **not** in a `'use server'` file. The table analogue S-01 writes wraps `runTableQuery`/a PostgREST write instead of an auth `{error}` call.
- Action files (`src/features/auth/actions/*.ts`) — each is `'use server'`, calls the wrapper, `return result` on failure, `redirect(...)` on success (`sign-in.ts`, `update-password.ts`). `sign-out.ts` is a bare `'use server'` action passed to `<form action={signOut}>` server-side.
- Schemas: `src/features/auth/schemas.ts` — per-field Zod (`emailSchema`) + composed object (`credentialsSchema`) + inferred `*T`. S-01 adds `src/features/notes/schemas.ts` (e.g. `noteInputSchema` { title, content }).

#### UI / routing pattern to mirror

- `src/app/(protected)/layout.tsx:1-17` — server component gate: `await createClient()` → `getUser()` → `redirect('/sign-in')` if no user. New note routes live **inside `(protected)`** and inherit this gate.
- `src/app/(protected)/dashboard/page.tsx` — server component fetches data directly; passes a server action to `<form action={...}>`. List/detail note pages follow this (server component → `getNotes()`/`getNote(id)`).
- Forms: `src/components/forms/hooks/form-hooks.ts` — `useAppForm` via `createFormHook`, registers `fieldComponents: { Input: FormInput }`. To get a markdown editor field, **register a new field component** (e.g. `MarkdownEditor`) in this hook, or compose the editor outside `useAppForm` and feed value back via `form.setFieldValue`. `src/app/(auth-pages)/sign-up/page.tsx:1-65` is the canonical full client-form wiring (defaultValues, `form.AppField` + Zod `validators`, `form.Subscribe` for isSubmitting, form-level error `useState`).
- `src/components/forms/form-components/form-input.tsx`, `form-error.tsx`, `utils.ts:getFieldErrorText` — field-component shape to copy for a textarea/editor field.
- shadcn (`components.json`): style `radix-nova`, `rsc:true`, base `neutral`, lucide icons, `@/` → `src/`. Installed UI: `button, card, input, label`. **Missing** (S-01 adds via `pnpm dlx shadcn@latest add …`): `textarea` (fallback editor / topic-check inputs later), likely `dialog` (delete confirm) or use native `confirm`/a server-action form. First shadcn additions beyond the F-01 four.

#### "Firsts" S-01 introduces in the repo

First mutation Server Action · first `revalidatePath`/`revalidateTag` · first `redirect` after a data write · first dynamic route (`[id]`) · first client-side `useRouter` (if used) · first product UI · first 3rd-party rendering/editor dependency · first markdown/highlight CSS in `globals.css`.

### External — editor + render stack (Context7 + exa, verified 2026-06-03)

#### Editor — validated: CodeMirror 6 via `@uiw/react-codemirror`

- Packages: `@uiw/react-codemirror@4.25.10` (peer `react>=17`, no upper bound → OK on 19.2), `codemirror@6.0.2`, `@codemirror/lang-markdown@6.5.0`, `@codemirror/language-data@6.5.2`.
- **Nested code-fence highlighting needs no per-language installs**: `markdown({ base: markdownLanguage, codeLanguages: languages })` where `languages` is `@codemirror/language-data`'s registry of **lazy dynamic imports** — a ` ```python ` fence pulls `@codemirror/lang-python` on demand, auto code-split. JS/TS/Python/Go/Rust all covered by one config.
- **Lazy-load** off the main bundle: `const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr:false })` — and `ssr:false` is **only legal inside a `'use client'` component** (Next 16 errors if used in a Server Component). CodeMirror touches `window`/`document`, so `ssr:false` is required, not optional. Add a `loading:` skeleton to avoid layout shift.
- CM core packages have **zero React dependency** → React 19 compat is purely the wrapper's concern, and the wrapper is fine. Hand-wiring an `EditorView` in `useEffect` is the fallback (wrapper exposes a `ref`); not needed.
- Real-world confirmation (exa): jqueryscript "Minimal Markdown Editor" (2026-02) uses exactly Next App Router + `@uiw/react-codemirror` + `@codemirror/lang-markdown` + react-markdown + remark-gfm for a side-by-side editor — the FR-007 shape.

#### Render view — react-markdown@10 + remark-gfm@4 (RSC); highlighter is the open decision

- `react-markdown@10.1.0` (peer `react>=18` → OK), `remark-gfm@4.0.1` (tables/task-lists/strikethrough — likely wanted for coding notes). Read view can be a **Server Component** (read-only, zero client JS for rendering).
- **Highlighter — the one live decision (owner: `/10x-plan`, per roadmap S-01 unknown).** Two validated paths, with a real integration trap:

  ⚠️ **The `processSync` trap.** react-markdown's default `<Markdown>` component highlights via `processSync` (synchronous). `@shikijs/rehype` is **async** → it does **not** work with the default component (confirmed by a post on the _exact_ stack: Next 16.2.3 / React 19.2.3 / react-markdown 10.1.0 / shiki 4). So Shiki-with-react-markdown requires one of: (a) `<MarkdownAsync>` (v10, RSC-only) + `@shikijs/rehype`; (b) Shiki's **sync core** `createHighlighterCoreSync` + `createJavaScriptRegexEngine` (no WASM, no async) wired through react-markdown's `components.code`; or (c) drop react-markdown for a direct `unified().use(remarkParse).use(remarkRehype).use(rehypeShiki).use(rehypeStringify)` pipeline + `dangerouslySetInnerHTML`.
  - **Option A — `rehype-highlight@7.0.2` + default `<Markdown>` + one `highlight.js@11.11.1` theme CSS import.** Synchronous, RSC-safe, ~16KB, **fewest moving parts**, no trap. highlight.js clears the NFR ("token meaning preserved: keywords/strings/comments/types distinguishable") for JS/TS/Python/Go/Rust. CSS comes from `highlight.js/styles/<theme>.css`, imported once.
  - **Option B — Shiki.** TextMate-grammar (VS-Code-accurate) output, dual light/dark themes, inline styles (no theme CSS file), **zero client bytes when run server-side**. Cost: heavier dep (~280KB but server-only), and the async/sync dance above. Stronger agent docs (`@shikijs/rehype`, llms.txt).

  **Recommendation (speed-weighted, MVP):** default to **Option A (rehype-highlight)** for v1 — it's the synchronous, RSC-clean, minimal path that satisfies the NFR and avoids the `processSync` trap entirely; Shiki is a clean v1.1 upgrade if token-accuracy on TS generics / JSX becomes a felt problem. This aligns with `main_goal: speed` and the 2026-06-10 deadline. `/10x-plan` owns the final lock (the Context7 leg leaned Shiki for output quality; the exa leg surfaced the integration friction that makes A the faster MVP call — both documented here so the decision is evidence-backed, not a coin-flip).

## Code References

- `src/features/notes/queries.ts:12-17` — `getNotes(client?)`, reuse for list view
- `src/features/notes/types.ts:4` — `NoteT` row type re-export pattern
- `src/lib/supabase/run-table-query.ts:11-27` — read wrapper; **throws on null data (l.25)** → not write-safe as-is
- `src/types/action.ts:2` — `ActionResultT`
- `src/features/auth/validate.ts:4-14` — `validateInput`
- `src/features/auth/run-auth-action.ts:13-26` — wrapper to mirror for a table-write wrapper
- `src/features/auth/actions/sign-in.ts`, `update-password.ts` — action shape (return-on-fail, redirect-on-success)
- `src/features/auth/schemas.ts` — Zod per-field + composed pattern
- `src/app/(protected)/layout.tsx:1-17` — auth gate inherited by new note routes
- `src/app/(auth-pages)/sign-up/page.tsx:1-65` — canonical `useAppForm` client-form wiring
- `src/components/forms/hooks/form-hooks.ts` — where to register a markdown-editor field component
- `components.json`, `src/app/globals.css` — shadcn config + theming tokens (no highlight CSS yet)
- `package.json:21-54` — confirms NO editor/markdown/highlight deps installed

## Architecture Insights

- **RLS-by-design carries into mutations**: the create action sends `{title, content}` only; `user_id` is DB-defaulted to `auth.uid()` and `with check`-enforced. Never accept `user_id` from the client. This is the same isolation contract F-02 verified — S-01 must not introduce an app-layer owner field.
- **Server Components for reads, client islands for interactivity**: list + detail (render) pages are server components calling the typed helpers; only the editor (CodeMirror) and the create/edit forms are `'use client'`. The render view stays a Server Component → highlighting cost (whichever lib) is server-side, zero client bytes.
- **Feature-first placement** (AGENTS.md): all new code born in `src/features/notes/` (`schemas.ts`, `actions/`, a `run-note-action.ts` or extended wrapper, a `render-markdown.tsx`/`note-editor.tsx` if feature-specific). Form _primitives_ (a reusable editor field) go in `src/components/forms/`; routes stay thin in `src/app/(protected)/notes/`. Promote to shared tiers only on a 2nd consumer.
- **Pattern lineage**: `runTableQuery` is explicitly "the table analogue of `runAuthAction`" (its own comment) — S-01's write wrapper completes that symmetry (the Strategy/Template-Method shape: a fixed skeleton — validate, get client, run, normalize — parameterized by the per-action call).

## Historical Context (from prior changes)

- `context/changes/persistence-and-isolation/plan.md` — F-02 contract S-01 builds on: the three-table schema, RLS `(select auth.uid())`, the `(user_id, due_at)` index (for S-03, not S-01), and the explicit deferral: "No mutation Server Actions — deferred to S-01/S-03/S-05." S-01 is the first to claim that deferred mutation work for `notes`.
- `context/changes/persistence-and-isolation/research.md` — Context7 RLS idioms; same external-research discipline applied here.
- `context/archive/2026-06-02-minimal-auth-and-session/` — F-01: source of the `useAppForm`, `run*Action`, `(auth-pages)` route-group, and `'use server'` action conventions S-01 mirrors.

## Related Research

- `context/changes/persistence-and-isolation/research.md` — internal Supabase wiring + Context7 RLS/typegen.

## Open Questions

1. **Highlighter lock (owner: `/10x-plan`).** rehype-highlight (recommended, MVP-fast) vs Shiki (better output, more integration friction). Non-blocking; resolved at plan time. Decision criteria + the `processSync` trap documented above.
2. **Editor field integration shape**: register CodeMirror as a `useAppForm` field component vs compose it alongside the form and sync via `form.setFieldValue`. `/10x-plan` decides; the live-preview split (FR-007) likely makes a composed layout cleaner than a single registered field.
3. **`title` requiredness**: nullable at DB; product likely wants required + non-empty at the app schema. `/10x-plan` to confirm against FR-007.
4. **Delete UX**: shadcn `dialog` confirm vs a plain server-action form button. Minor; `/10x-plan`/implementation choice.
