---
change_id: subject-sidebar-nav
title: Docs-style single-pane subject view with sidebar nav + drag-reorder
status: implementing
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

A **new, separate** subject view to A/B against the current one. UX-led experiment ("test how it feels"), not a perf fire — prod renders the continuous view fast; the 10s figure that motivated this was a `next dev` mirage (see `context/foundation/lessons.md`).

**Coexistence (locked):** the current continuous "subject-as-document" view at `/subjects/[id]` stays **exactly as-is, untouched**. The single-pane view is a **separate route** so both can be compared. If single-pane wins later, replacing the continuous view is a _future_ cleanup slice — out of scope here.

**Depends on `inline-edit-notes-and-subjects` (B):** the single-pane "click a note → open it light, fast" only works because B makes the note's read-only render the cheap default. B lands first.

**Decisions (locked):**

- **Architecture = Next.js layout + nested segment (the real vercel/nextjs docs pattern).** A `layout.tsx` holds the sidebar (persists across clicks); a nested `[noteId]` segment server-renders just the active note. Clicking a sidebar link is a soft RSC navigation → only the content streams, the sidebar never re-renders. A `?note=` searchParam was rejected: it re-renders the whole page incl. sidebar on every click, defeating the "feels fast" test.

  ```
  /subjects/[id]/read/            layout.tsx → PageShell + sidebar (client dnd list)
                                  page.tsx   → redirect to first note (or empty prompt)
                /read/[noteId]/   page.tsx   → server-renders that note's light read-only body
  ```

- **Route name not locked** — `read` is a placeholder ("we'll see"); `browse` / `doc` candidates. Continuous view stays at `/subjects/[id]`.
- **Sidebar rows = Link + separated drag handle.** Each row is a Next `<Link>` (jump/swap the active note) **and** draggable. Listeners on the whole row would make click fight drag → dnd listeners live on a **dedicated grip handle** only; the rest of the row is the link. This is the Cluster 2 "separate the drag handle from the card body" item, folded in. Active note highlighted by matching the route segment. Reorder writes via the existing `reorderNote` action.
- **Virtual scroll: deferred (assess-only).** Single-pane renders ~1 body, not 52 — the load that would justify virtualization no longer exists. Spec notes the assessment; does not build it.

**Open for /10x-plan:** final route name; how the sidebar dnd client island coexists with `<Link>` rows (refactor of the current `ReorderableNoteList`, which puts listeners on the whole `<li>`); empty/first-note redirect behavior; a way to flip between continuous and single-pane views; whether the sidebar list reads titles-only (it should — don't over-fetch `content` for the nav).

**Scope guard:** new view + sidebar nav + handle split only. In-place editing = `inline-edit-notes-and-subjects` (B); Shiki langs = `shiki-lang-source-of-truth` (A).
