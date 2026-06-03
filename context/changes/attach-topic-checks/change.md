---
change_id: attach-topic-checks
roadmap_id: S-02
linear: EX-362
status: implementing
created: 2026-06-03
updated: 2026-06-03
prerequisites: [S-01]
prd_refs: [FR-012, FR-013, FR-014, FR-015, US-01]
---

# Change: attach-topic-checks (S-02)

Topic-check CRUD attached to a note: attach (question + optional example + optional
code-block context), edit, delete, and list all topic checks on a given note.

The `topic_checks` table already exists from F-02 (with SM-2 scheduling columns that stay
**unwritten until S-03**). This slice is the write path + inline UI on the note detail page.

See `plan-brief.md` for the two-page summary and `plan.md` for the full contract.
