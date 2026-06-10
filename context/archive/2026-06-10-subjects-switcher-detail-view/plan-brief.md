# Subject Switcher in Detail View — Plan Brief

> Full plan: `context/changes/subjects-switcher-detail-view/plan.md`

## What & Why

The standalone `/subjects` card list is redundant once you can switch, edit, and delete subjects from
within the detail view itself. This change collapses the list into the detail view via a **subject
switcher** at the top, removing a whole navigation hop and an entire screen to maintain.

## Starting Point

Today `/subjects` is a paginated card list (`SubjectsList`), separate from the detail view
(`[id]/layout.tsx`) — a two-pane notes sidebar + content layout whose header carries New note / Edit /
Delete and a "← Subjects" back link.

## Desired End State

Every subject view shows a switcher (reads the current subject, picking another navigates) plus a "New
subject" button at the top; "Edit subject" / "Delete subject" on the right; and "Add note to this
subject" atop the notes list. `/subjects` redirects to the first subject, or shows an empty state when
there are none. The old list, its query, and its row type are gone.

## Key Decisions Made

| Decision                  | Choice                                            | Why                                                        | Source     |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| Listing page fate         | Remove — `/subjects` redirects into the detail    | The switcher fully replaces it; one screen is the goal     | Brainstorm |
| Switcher placement        | `eyebrow` slot (Design A)                         | Zero change to the shared `PageShell`; lowest risk         | Brainstorm |
| "New subject" entry point | Button next to the switcher (top of page)         | Keeps the detail header uncluttered                        | Brainstorm |
| Subject action labels     | "Edit subject" / "Delete subject"                 | Bare "Edit"/"Delete" were ambiguous about their target     | Brainstorm |
| Add-note action           | "Add note to this subject", atop the notes column | Scopes it clearly to notes — the confusion being fixed     | Plan       |
| Switcher widget           | Reuse `Combobox` + `getSubjects()`                | Built-in search replaces the old list search; no new query | Plan       |

## Scope

**In scope:** new `subject-switcher.tsx`; rewire `[id]/layout.tsx` header + notes column; `/subjects` →
redirect/empty-state; delete `subjects-list.tsx` + `getSubjectsList` + `SubjectListItemT`.

**Out of scope:** the two-pane note layout, dnd reorder, `[noteId]` content pane, `PageShell`,
`/subjects/new`, subject forms, `subject-filter.tsx`, `SearchFilterInput`/`PaginationFooter`.

## Architecture / Approach

Server `layout.tsx` fetches `getSubjects()` and passes the list + current id to a client
`SubjectSwitcher` (a value-bound `Combobox` that `router.push`es on change). `/subjects` becomes a
server redirect to the first subject. Existing create/delete redirects already point where we want, so
no action changes are needed.

## Phases at a Glance

| Phase                                  | What it delivers                                | Key risk                                           |
| -------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| 1. Switcher + detail header rewire     | Switcher, New subject, relabels, add-note moved | Scroll containment when wrapping the notes sidebar |
| 2. Collapse listing + remove dead code | `/subjects` redirect + dead-code removal        | Dangling imports of the removed list/query/type    |

**Prerequisites:** implemented in a fresh worktree branched off local `main` (after this branch merges).
This change folder must be committed before that merge so it rides into the worktree.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The notes-column scroll containment must survive wrapping `SubjectNoteSidebar` with the add-note
  button (flagged in Critical Implementation Details).
- "First subject" for the redirect = first row of `getSubjects()`'s existing ordering; no last-viewed
  memory (out of scope).

## Success Criteria (Summary)

- Switch / create / edit / delete subjects entirely from the detail view; add notes from there too.
- `/subjects` and the nav item resolve into a subject (or a create-first empty state).
- `pnpm typecheck` / `pnpm lint` / `pnpm build` pass; no dangling references to the removed code.
