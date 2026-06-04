# Handoff — S-14 `inline-edit-notes-and-subjects`

> For a fresh session picking this up in a separate git worktree. Self-contained; read this first, then the brief.

## Status

- **Change**: `inline-edit-notes-and-subjects` (roadmap **S-14**, v2 UX, band: v2 / post-deadline).
- **State**: `change.md` status `plan_reviewed`. Plan verdict **SOUND** (was REVISE → fixed all 4 plan-review findings).
- **Next action**: `/10x-implement inline-edit-notes-and-subjects phase 1`.
- **Linear**: not yet created an EX issue for S-14 (S-13/S-16 have issues; S-14 does not). Create one when starting if you want it tracked, else proceed.

## Artifacts (all in `context/changes/inline-edit-notes-and-subjects/`)

- `change.md` — design + locked decisions.
- `research.md` — full internal research (the `?edit` idiom, PRG, PageShell, shared-helper analysis). Read the Summary + Open Questions.
- `plan.md` — the contract to implement. 2 phases + Progress checklist.
- `plan-brief.md` — 2-min overview + Key Decisions table. **Start here.**
- `reviews/plan-review.md` — the 4 findings + how each was fixed.

## What we're building (one paragraph)

Collapse view+edit into one page for notes and subjects. `/notes/[id]?edit=note` swaps the read-only body+subject into the existing `NoteForm` in place; `/subjects/[id]?edit` swaps the header into `SubjectForm`. Delete both `/notes/[id]/edit` and `/subjects/[id]/edit` routes. It's a generalization of the already-shipped topic-checks `?edit=<checkId>` pattern — server-driven (no client `isEditing`; forced because `RenderMarkdown` is async/server-only). PRG is preserved verbatim (update actions already `redirect(bare path)`, which drops `?edit` and unmounts the form).

## The 3 gotchas that WILL bite if missed (from plan-review)

1. **`?edit` is dual-meaning on the note page** — `note` (body) vs `<checkId>` (a topic check), one param, mutually exclusive. When `edit === 'note'` you MUST pass `editId={undefined}` to `TopicChecksSection`. If you forward `editId={edit}`, its stale-guard `if (editId && !editingCheck) redirect(...)` (`topic-checks-section.tsx:25`) fires (no check has id `note`) and silently ejects the user from body-edit. Verified necessary+sufficient. The E2E must assert `?edit=note` does NOT redirect.
2. **PageShell title can't be suppressed (F1)** — `PageShell.title` is a required `string` always rendered as `<h1>`. Don't try to empty it. In edit mode pass `title="Edit note"` / `"Edit subject"` (mirrors the deleted `/edit` routes) and render the form as children → no duplicate title, no PageShell change. Applies to BOTH phases.
3. **Actions slot in edit mode (F2)** — swap the PageShell `actions` slot to a single Cancel `<Link href={bare path}>`; drop Edit/Delete (and subjects' New-note) while editing.

## Worktree setup ritual (origin is STALE — branch off LOCAL HEAD)

`origin/main` was never pushed; branch off the local commit. Current `main` HEAD: **`8e32baa`** (re-verify with `git -C /Users/konradantonik/workspace/10x_devs rev-parse HEAD` — a parallel session may have advanced it).

```bash
cd /Users/konradantonik/workspace/10x_devs
git worktree add ../10x_devs-s14 HEAD          # or a named branch: git worktree add -b s14-inline-edit ../10x_devs-s14 HEAD
cp .env.local ../10x_devs-s14/.env.local        # gitignored — NOT copied by worktree add; build/E2E need it
cd ../10x_devs-s14 && mise trust && mise install
```

Then open the new session with cwd `../10x_devs-s14`. Why a worktree: keeps S-14 isolated from any parallel session sharing the main tree (S-13 shiki and S-16 toasts have churned here before) — cross-contamination becomes structurally impossible. As of this commit the main tree is clean, but the isolation guarantee still holds for whatever lands next.

## File-touch coordination (parallel sessions)

- **S-13 (shiki)** touches `src/components/markdown/render-markdown.tsx` ONLY. S-14 does NOT need to touch it. No overlap.
- **S-16 (toasts)** owns success-feedback (`?toast=`). S-14 deliberately ships redirects **bare** — do NOT build a notice/toast here; it gains `?toast=note-saved` when S-16 lands.
- If working in the main tree instead of a worktree: stage by explicit path only (`git add <path> …`), NEVER `git add -A`/`.` — it would sweep the other sessions' half-done work.

## Project review gate (CLAUDE.md — the order is mandatory)

implement feature code → **review fan-out** (4 read-only checks: `/10x-impl-review`, `/tailwind-v4-audit`, `feature-first-structure`, `/module-cohesion-audit`) → **`/simplify`** (serial, mutates) → **author + run tests** (E2E here; full suite last: typecheck/lint/test/test:e2e/build) → `/10x-archive` → **post-archive sync** (Linear Done + update CLAUDE.md tracking + roadmap S-14 → done + lessons if any).

- E2E needs the local Supabase stack up (`supabase start`). Feature code + typecheck/lint/build do not.
- Tests are authored AFTER `/simplify`, not before (lock specs against post-simplify code).

## Files this change touches (from the plan)

- `src/app/(protected)/notes/[id]/page.tsx` — add `?edit=note` branch, relabel title, Cancel link, `editId={undefined}` guard.
- `src/app/(protected)/notes/[id]/edit/page.tsx` — **delete** (route segment).
- `src/app/(protected)/subjects/[id]/page.tsx` — add `searchParams` + `?edit` branch, relabel title, Cancel link.
- `src/app/(protected)/subjects/[id]/edit/page.tsx` — **delete** (route segment).
- Reused as-is (no change): `NoteForm`, `SubjectForm`, `updateNote`, `updateSubject`, `PageShell`, `TopicChecksSection`.
- Tests: extend `e2e/notes.spec.ts` + `e2e/subjects.spec.ts` (reuse `e2e/helpers.ts`).

## Relevant lessons (context/foundation/lessons.md)

- Measure "read view stays light" in a **production build** (`pnpm build && pnpm start`, isolated port/dist), never `next dev`.
- E2E: `reuseExistingServer: false`; local-GoTrue sign-up flake is environmental (don't gate; `retries: 2` handles it).
- Ids validate with `z.guid()` (shape), not `z.uuid()` — already correct in the schemas; no change needed.
