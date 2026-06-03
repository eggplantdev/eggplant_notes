---
change_id: create-note-with-checks
title: Attach topic checks inline while creating a note
status: implementing
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

Roadmap slice **S-07** (fast-follow band). Outcome: when creating a note, the user can attach one or more topic checks in the **same flow** and save them together — instead of today's "create note → redirect to detail → then add checks".

Known trap (the FK constraint): `topic_checks.note_id` is `not null` — a check cannot exist before its note. Flow: stage checks client-side → insert the note → insert staged checks with the new `note_id`. Two ordered writes. Atomicity (note inserts but checks fail) + PRG interaction are the two `/10x-plan` decisions.
