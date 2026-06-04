---
change_id: inline-edit-notes-and-subjects
title: Collapse view + edit into one page for notes and subjects (in-place editing)
status: archived
created: 2026-06-04
updated: 2026-06-04
archived_at: 2026-06-04T10:33:23Z
---

## Notes

UX-coherence slice. Today editing is split incoherently: `/notes/[id]` already edits the **subject** (picker) and **topic checks** (inline `?edit=<checkId>`) on the view page, but the **note body** edit is exiled to a separate `/notes/[id]/edit` page. Subjects have the same split (`/subjects/[id]` + `/subjects/[id]/edit`). Goal: nothing navigates you away to edit — light read-only default, edit in place.

**Foundation for the `subject-sidebar-nav` slice** (C): C's single-pane "click a note → open it light" only works because B makes the note's read-only render the cheap default. B must land before C.

**Decisions (locked):**

- **searchParam-driven, not client `useState` — forced by a real constraint.** `RenderMarkdown` is server-only (Shiki / `MarkdownAsync`); a client `isEditing` toggle can't swap server-rendered markdown for the client editor without RSC gymnastics. So edit mode is driven by the URL: the server reads `searchParams` and renders read view or edit form. The heavy lazy CodeMirror island only mounts in edit mode → light read-only stays the default. This extends the convention topic checks already use (`?edit=<checkId>`, server-rendered, no client state).
- **Topic checks stay separate (lower risk, already works).** Edit mode toggles **body + subject** only (the old `/notes/[id]/edit` form, now inline). Topic checks keep their existing independent inline `?edit=<checkId>` CRUD — folding them into one transactional Save would mean rewriting the per-check Server Actions into a staged batch and would lose "fix one check without touching the body."
- **Param reconciliation:** reserve `?edit=note` for the body+subject form; `?edit=<uuid>` stays "edit that check." The server inspects the value. One param, mutually exclusive branches.
- **Subject side (2nd consumer):** `/subjects/[id]` gets `?edit` toggling the `PageShell` header (title/description) into fields with Save/Cancel.
- **Delete both `/edit` routes:** `/notes/[id]/edit` and `/subjects/[id]/edit`. Their form logic moves into the `?edit` branch of the detail page.
- **Promotion:** note = 1st consumer of the `?edit`-toggle convention, subject = 2nd → promote a small shared edit-toggle helper (per the project's 2nd-consumer promotion rule) instead of duplicating.

**Open for /10x-plan:** exact shape of the shared edit-toggle helper; where the body form component lives after the route deletion (likely `features/notes/` reusing the existing `NoteForm`); preserving the PRG redirect-on-success behavior now that edit is a searchParam branch rather than a route.

**Scope guard:** view+edit consolidation only. Shiki langs = `shiki-lang-source-of-truth`; sidebar nav = `subject-sidebar-nav`.

**Verification:** read view stays light (no CodeMirror in the default render); `?edit=note` edits body+subject in place; topic-check inline CRUD still works; both old `/edit` routes 404/removed; Playwright covers the note + subject in-place edit paths.
