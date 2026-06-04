---
date: 2026-06-04T11:00:42+0200
researcher: ex-Plant
git_commit: 60a807c0bdb8dc8800c6991ae6acc8f03eab2d1e
branch: main
repository: 10x_devs
topic: 'Inline-edit (?edit-toggle) for notes and subjects — collapse view+edit into one page'
tags: [research, codebase, inline-edit, searchparams, prg, server-actions, notes, subjects]
status: complete
last_updated: 2026-06-04
last_updated_by: ex-Plant
---

# Research: Inline-edit (`?edit`-toggle) for notes and subjects

**Date**: 2026-06-04T11:00:42+0200
**Researcher**: ex-Plant
**Git Commit**: 60a807c0bdb8dc8800c6991ae6acc8f03eab2d1e
**Branch**: main
**Repository**: 10x_devs

## Research Question

S-14 (`inline-edit-notes-and-subjects`) collapses view+edit into one page for notes and subjects: light read-only default, `?edit` searchParam toggles an in-place form (body+subject for notes; title/description for subjects), and the separate `/notes/[id]/edit` + `/subjects/[id]/edit` routes are deleted. The `change.md` left three open questions for planning:

1. Exact shape of the shared edit-toggle helper.
2. Where the body form component lives after the route deletion.
3. Preserving PRG redirect-on-success now that edit is a searchParam branch, not a route.

## Summary

The codebase already implements the exact target pattern once: **topic-checks inline edit via `?edit=<checkId>` on `/notes/[id]`**. It is fully server-driven (no client `isEditing` state), which is _forced_ by `RenderMarkdown` being an async, server-only Shiki component that cannot live behind a client toggle. S-14 generalizes that same idiom to the note body (`?edit=note`) and the subject header (`?edit` on `/subjects/[id]`).

Key findings that resolve the three open questions:

- **(Open Q2 — form location):** The forms to inline already exist and are reused as-is. `NoteForm` (`src/features/notes/note-form.tsx`) is a union-typed create/edit form; `SubjectForm` (`src/features/subjects/subject-form.tsx`) likewise. The `/edit` route pages are thin wrappers (~20 lines) that fetch + render these forms. Inlining = move that fetch+render into the `?edit` branch of the detail page; delete the wrapper routes. **No new form component needed.**
- **(Open Q3 — PRG):** Today `updateNote`/`updateSubject` do `revalidatePath(list) + revalidatePath(detail) + redirect(detail)` — the redirect _throws_ (`NEXT_REDIRECT`), so the form's `onSubmit` only ever sees the failure branch; success is proven by navigation. This is **preserved verbatim** — the action still redirects to the bare detail path (`/notes/${id}`), which now drops `?edit` and unmounts the form. **The action barely changes; only the entry point (route → `?edit` link) changes.**
- **(Open Q1 — shared helper):** The toggle mechanism is `<Link href="?edit">` (enter) + `<Link href={bare path}>` (cancel) + server reads `await searchParams` + stale-`?edit` `redirect` guard + `key`-remount of the client form. That is ~3-5 lines per consumer. **Recommendation: do NOT promote a generic shared helper** — it is below the abstraction bar; mirror `topic-checks-section.tsx` inline in each feature. (Tension with `change.md`'s "promote on 2nd consumer" note — see Open Questions.)

A cross-cutting dependency surfaced: **S-16 (`action-feedback-toasts`) is mid-flight (P1 landed) and is generalizing the `?deleted=1`→`DeletedNotice` flag into a reusable `?toast=<key>` post-redirect reader.** S-14's redirect-on-success should ride that `?toast=note-saved` flag rather than rolling its own notice — and the S-16 reader strips _only_ the `toast` param, so it is safe beside `?edit`.

## Detailed Findings

### A. The note detail page + the `?edit=<checkId>` precedent (the model to copy)

`src/app/(protected)/notes/[id]/page.tsx`:

- `page.tsx:17-25` — async Server Component; `searchParams: Promise<{ edit?: string }>`; `const { edit } = await searchParams` (line 25). Separate awaits for `params` and `searchParams`.
- `page.tsx:53` — `<RenderMarkdown content={note.content} />` renders **unconditionally** today (the note body has no edit branch yet).
- `page.tsx:55` — `editId={edit}` passed to `TopicChecksSection`.
- `page.tsx:44-46` — the note "Edit" button currently `<Link>`s to the **separate** `/notes/${note.id}/edit` route. **This is the link S-14 converts to `?edit=note`.**

`src/features/topic-checks/topic-checks-section.tsx` (the canonical inline-edit idiom):

- `:22` — `const editingCheck = editId ? checks.find((c) => c.id === editId) : undefined`
- `:25` — **stale-param guard:** `if (editId && !editingCheck) redirect(`/notes/${noteId}`)` — drops a `?edit` pointing at a deleted/non-owned row.
- `:43` — enter-edit link: `<Link href={`/notes/${noteId}?edit=${check.id}#topic-check-form`}>Edit</Link>`
- `:59` — `<TopicCheckForm key={editId ?? 'new'} noteId={noteId} check={editingCheck} />` — the `key` forces unmount/remount (state reset) when the edit target changes.
- `topic-check-form.tsx:1` — the form is `'use client'`; it receives server-seeded `check` data as a prop. On success-edit it `router.push(`/notes/${noteId}`)` to exit (`:45`); cancel is a `<Link>` to the bare path (`:109-111`).

### B. `RenderMarkdown` forces server-driven edit toggling (the constraint behind the design)

`src/components/markdown/render-markdown.tsx:21` — `export async function RenderMarkdown(...)`, an **async Server Component** using `MarkdownAsync` + `@shikijs/rehype` (lines 24, 28-35). Header comment (lines 9-14): "Runs server-side only — zero highlighting bytes reach the client. Must NOT be imported into a client component." → a client `isEditing` `useState` cannot swap the server-rendered read view for the client editor. Hence the URL drives edit mode. (This is also the S-13 boot-cost surface — unconstrained `langs` = ~3.3s/129MB; not changed here.)

### C. The note edit route + `NoteForm` + `updateNote` PRG

`src/app/(protected)/notes/[id]/edit/page.tsx:12-22` — thin async wrapper: awaits params, `Promise.all([getNote(id), getSubjects()])`, `notFound()` if missing/not-owned, renders `<PageShell><NoteForm action={updateNote} note={note} subjects={subjects} /></PageShell>`.

`src/features/notes/note-form.tsx`:

- `:36-47` — union props: edit branch has `note: NoteT` + `action: (id, input) => Promise<ActionResultT>`; create branch has `note?: undefined` + `action: (input) => …`. `note` presence narrows the union.
- `:75-93` — `useAppForm` (TanStack Form); `defaultValues` seed from `note` (edit) or empty (create).
- `:82-92` — `onSubmit`: edit calls `props.action(props.note.id, noteInput)`; create calls `props.action({ note, checks })`. On `!result.success` → `setFormError`. **On success the action redirects (throws), so the form never sees success** (comment `:54-56`: "mirrors sign-up/page.tsx").
- `:108-123` — subject picker (Combobox), sentinel `'none'` → `null`. `:171-254` — inline checks array field, **create mode only** (`!note` guard).

`src/features/notes/actions/update-note.ts`:

- `:16` — `export async function updateNote(id: string, input: unknown): Promise<ActionResultT>`
- `:17-18` — id validated with `noteIdSchema = z.guid('Invalid note id')` (shape only — see lessons.md; **not** `z.uuid()`).
- `:20-43` — `runTableAction(noteInputSchema, input, ...)`; subject re-derive only when `subject_id` changes, `position = Date.now()` (append; no `max()` read).
- `:44-48` — **PRG:** `if (!result.success) return …` → `revalidatePath('/notes')` → `revalidatePath(`/notes/${id}`)` → `redirect(`/notes/${id}`)`.

`src/features/notes/actions/create-note.ts:22,37-38` — `createNote(input)`; atomic `create_note_with_checks` RPC; `revalidatePath('/notes')` + `redirect(`/notes/${newId}`)` (no detail revalidate — page never visited).

Contrast — `src/features/notes/actions/assign-subject.ts:55-57` — `assignNoteSubject` does **not** redirect: revalidate + `return { success: true }`; the inline `NoteSubjectPicker` owns optimistic state via `useActionTransition`. (Shows the "no-redirect inline action" path already exists, if S-14 ever wanted in-place save without navigation.)

### D. The subject side — detail page, PageShell, `updateSubject`

`src/app/(protected)/subjects/[id]/page.tsx`:

- `:16-19` — async; `params` Promise; **does NOT read searchParams today** → no conflict adding `?edit`.
- `:22-38` — renders `<PageShell title={subject.title} subtitle={subject.description ?? undefined} width="prose" backHref="/subjects" backLabel="Subjects" actions={…}>`; actions = New note / Edit / Delete buttons. The "Edit" button links to `/subjects/[id]/edit` (the route S-14 replaces).
- `:40-67` — content: `ReorderableNoteList` (client drag component, does **not** read searchParams) + rendered note sections (static server markup). No searchParam conflict.

`src/components/layout/page-shell.tsx`:

- `:14-28` — props `{ title: string; subtitle?: ReactNode; actions?: ReactNode; backHref?; backLabel?; width?; children }`. `'use client'` (`:1`), motion animations.
- `:76-84` — header renders `title` as `<h1>` (`:78`) + optional subtitle `<p>` (`:81`) + `{actions}` slot (`:83`). **No editable-header slot today.** Subject inline edit must either (a) conditionally render the form in place of PageShell's title/subtitle in the page, or (b) add an optional `titleNode?: ReactNode` slot to PageShell that takes precedence over `title`. (b) touches the shared tier; (a) keeps it feature-local.

`src/app/(protected)/subjects/[id]/edit/page.tsx:10-24` — thin wrapper: `getSubject(id)`, 404 guard, `<PageShell title="Edit subject"><SubjectForm action={updateSubject} subject={subject} /></PageShell>`.

`src/features/subjects/subject-form.tsx:18-33,45-75` — union props (edit if `subject` present); `useAppForm` seeds from `subject.title`/`subject.description`; edit calls `props.action(props.subject.id, value)`; title field validated by `subjectTitleSchema`, description optional textarea; button "Save changes"/"Create subject".

`src/features/subjects/actions/update-subject.ts:13-29` — `updateSubject(id, input)`; `subjectIdSchema = z.guid()` (`schemas.ts:26`); `runTableAction`; on success `revalidatePath('/subjects')` + `revalidatePath(`/subjects/${id}`)` + `redirect(`/subjects/${id}`)`. Same PRG shape as `updateNote`.

`src/features/subjects/queries.ts:22-33` — `getSubject(id)` uses `.maybeSingle()` (returns `undefined`, doesn't throw on 0 rows).

### E. Cross-cutting conventions

**Next 16 searchParams (always awaited, Promise-typed, optional string, presence/equality checks only):**

- `notes/[id]/page.tsx:17-25` (the model), `notes/page.tsx:15-19` (`?subjects`), `notes/new/page.tsx:12-16` (`?subject`, awaited concurrently via `Promise.all([getSubjects(), searchParams])`).

**Promotion (2nd-consumer rule, AGENTS.md "Project structure"):** generic mechanism → `src/components/`/`src/hooks/`; feature wiring stays in `src/features/`. Precedents: `src/components/markdown/markdown-editor.tsx` (note+check 2nd consumer, controlled `{value,onChange}`), `src/hooks/use-action-transition.ts:14` (explicitly "promoted on the 2nd consumer", caller injects a `() => Promise<ActionResultT>` thunk), `src/components/layout/page-shell.tsx`, `src/components/ui/combobox.tsx`. Cross-feature `*T` → `src/types/` (`note.ts`, `subject.ts`, `action.ts`).

**The `?deleted=1` → `DeletedNotice` flag (and its S-16 `?toast=` generalization):**

- Today: `delete-account.ts:26` → `redirect('/sign-in?deleted=1')`; `deleted-notice.tsx:9-11` is `'use client'` reading `useSearchParams().get('deleted')`, **must be inside `<Suspense>`** (build-breaking otherwise; boundary at `sign-in/page.tsx:32-34`). It does not clear the param.
- S-16 (in progress, P1 committed): a closed `TOAST_MESSAGES` key→message `as const` map + `src/components/action-toast.tsx` reader mounted once in root layout (inside `<Suspense>`), toasts on mount and **strips only the `toast` param** via `new URLSearchParams(...); next.delete('toast'); router.replace(...)` — preserving siblings like `?edit`. Redirect actions append `?toast=note-saved`. `deleted-notice.tsx` is slated for deletion (folded into `?toast=account-deleted`). Refs: `context/changes/action-feedback-toasts/plan.md:219,227,231-237`.

**Navigation-toggle idioms:** server `<Link href="?edit">` (the edit model — `topic-checks-section.tsx:43`); client `useRouter().replace` with `URLSearchParams` inside `startTransition` (filter model — `notes-filter.tsx:38-44`, overkill for an edit toggle); Route Handlers read `new URL(request.url).searchParams` synchronously (`api/auth/confirm/route.ts:13-15`, irrelevant here).

**Boundaries:** **no `loading.tsx`/`error.tsx` anywhere in `src/app`**; only `<Suspense>` is the sign-in `DeletedNotice` wrapper. A server-prop `?edit` (the section pattern) needs no Suspense; only a client `useSearchParams` read would.

## Code References

- `src/app/(protected)/notes/[id]/page.tsx:17-25,44-46,53,55` — detail page searchParams + the Edit-link to convert + unconditional body render
- `src/features/topic-checks/topic-checks-section.tsx:22,25,43,59` — the exact `?edit` idiom to mirror (find / stale-guard / link / key-remount)
- `src/components/markdown/render-markdown.tsx:9-14,21` — server-only async constraint forcing URL-driven edit
- `src/app/(protected)/notes/[id]/edit/page.tsx:12-22` — route to delete; its fetch+render moves into the `?edit` branch
- `src/features/notes/note-form.tsx:36-47,82-92` — reusable union form; onSubmit only sees failure (redirect throws)
- `src/features/notes/actions/update-note.ts:16-48` — PRG to preserve verbatim (revalidate ×2 + redirect to bare path)
- `src/app/(protected)/subjects/[id]/page.tsx:16-38` — subject detail; no searchParams today (safe to add `?edit`)
- `src/components/layout/page-shell.tsx:14-28,76-84` — header has no editable slot; decide (a) feature-local conditional vs (b) `titleNode` slot
- `src/features/subjects/subject-form.tsx:18-33` + `actions/update-subject.ts:13-29` — subject form + PRG (same shape as note)
- `context/changes/action-feedback-toasts/plan.md:219,227,231-237` — the `?toast=` mechanism S-14 should ride

## Architecture Insights

- **The design is a generalization of one proven, in-repo pattern**, not a new one. Risk is low: the toggle, stale-guard, key-remount, and PRG are all already shipped on topic-checks. S-14 applies them to the note body and subject header and removes two redundant routes.
- **The forms are already edit-capable** (union props). The `/edit` routes add nothing but a URL; deleting them and entering via `?edit` is a net simplification.
- **PRG is preserved by keeping `redirect()` to the bare detail path.** Because the redirect drops `?edit`, the form unmounts on success automatically — no extra "close the form" logic needed. The only enhancement is appending `?toast=note-saved`/`?toast=subject-saved` once S-16's reader lands.
- **`RenderMarkdown` server-only is the architectural forcing function** for the whole searchParam-over-`useState` decision — worth restating in the plan so a future reader doesn't "simplify" it to a client toggle.

## Historical Context (from prior changes)

- `context/archive/2026-06-03-attach-topic-checks/` — introduced the `?edit=<checkId>` server-driven inline edit this slice generalizes.
- `context/archive/2026-06-03-organize-notes-into-subjects/` — subjects table + `SubjectForm` + `/subjects/[id]/edit` route now being inlined; `ReorderableNoteList` (dnd-kit) on the subject page.
- `context/changes/action-feedback-toasts/plan.md` — the `?toast=` post-redirect reader S-14's success path should target (in progress; P1 landed).
- `context/changes/shiki-lang-source-of-truth/` — S-13, also in flight, touches `render-markdown.tsx` only; no overlap with S-14's page/form changes beyond the shared file (coordinate if both edit `render-markdown.tsx`, but S-14 does not need to).

## Related Research

- None prior for this change. Sibling design docs: `context/changes/subject-sidebar-nav/change.md` (S-15, depends on this slice's light read view).

## Open Questions

1. **Shared edit-toggle helper — promote or not? (the `change.md` "2nd consumer" tension).** `change.md` says note=1st / subject=2nd consumer → promote a shared toggle helper. Research finds the "mechanism" is ~3-5 lines (`<Link href="?edit">` + `await searchParams` + stale-`redirect` guard + `key`-remount) — below the abstraction bar; the genuinely shared seams (`useAppForm`, `MarkdownEditor`, `PageShell`, `useActionTransition`, `?toast=`) are _already_ promoted. **Recommendation: keep the toggle inline per feature, mirroring `topic-checks-section.tsx`; do not add a new shared tier.** `/10x-plan` to make the call explicitly (and if it promotes, define exactly what — likely nothing more than a typed `editParam` helper, if even that).
2. **Subject header edit — PageShell `titleNode` slot (shared-tier change) vs feature-local conditional render?** (b) is cleaner but touches `src/components/layout/page-shell.tsx` (a shared primitive consumed by every page); (a) keeps PageShell untouched. `/10x-plan` to decide; lean (a) unless the form-in-header genuinely needs PageShell's layout.
3. **Sequencing vs S-16.** If S-14 lands before S-16 P4, its redirects ship bare (`redirect('/notes/${id}')`) and gain `?toast=` later — do **not** build a throwaway notice component. Confirm ordering in the plan.
4. **Manual perf check must use a production build** (lessons.md) — "read view stays light" is the success criterion; verify in `next start`, not `next dev`.
