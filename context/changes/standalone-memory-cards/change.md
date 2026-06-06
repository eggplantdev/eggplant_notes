---
change_id: standalone-memory-cards
title: Create memory cards directly without first authoring a note
status: implemented
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

## Notes

Today cards can only be created from inside a note. We want a "New card" entry point — on the dashboard next to "New note", and on the memory-cards surface itself — that lets a user create a card directly. In that standalone flow the user only picks a Topic/Subject (no note authoring). If it's simpler to keep the data model intact, the standalone path can auto-create a backing note so every card still has its `note_id`.
