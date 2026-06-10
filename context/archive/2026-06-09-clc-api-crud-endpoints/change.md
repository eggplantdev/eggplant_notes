---
change_id: clc-api-crud-endpoints
title: Extend CLC token API — read-back, create-subject, and update endpoints with linked/unlinked card semantics
status: archived
created: 2026-06-09
updated: 2026-06-09
archived_at: 2026-06-09T12:32:52Z
---

## Notes

extend the CLC token HTTP API: read-back (GET note-by-id with cards, GET memory-cards), create subject (POST /api/subjects), and update endpoints (PATCH notes/cards/subjects) including subject-switching with the app's linked/unlinked card semantics. Staged: Phase 1 easy wins (reads, create-subject, plain-field updates), Phase 2 subject-switching + skill docs for linked/unlinked.

Follows on from `cli-token-ui-and-skill-download` (the token API + skill download + Settings UI). The skill markdown fence-the-code fix (example/code_context are markdown) was made under that prior change; this change adds new endpoints and must extend the skill doc + regen `skill-template.ts` + update the pinning test for each new endpoint.

Key facts verified in code (research, 2026-06-09):

- Auth: every route runs `authenticateRequest` → Bearer → `resolve_api_token` RPC → minted user JWT → RLS-scoped `auth.supabase`. Ownership is automatic; no manual user_id filtering, no service-role.
- POST routes reuse injectable CORES (`insertNoteWithChecks`, `insertCardsForNote`, `insertStandaloneCard`) that accept a supabase client. The UPDATE logic currently lives in cookie-session server actions (`updateNote`, `updateMemoryCard`, `createSubject`, `unlinkCardFromNote`) → must be extracted into injectable cores so API routes (JWT client) and actions (cookie client) share them.
- Invariant (app-enforced, NO db trigger — migration 20260606161054): an attached card (note_id set) must have subject_id == its note's subject. Standalone card (note_id null) owns subject freely.
- Move a NOTE's subject (`updateNote`): per-card choice `{ move:[], unlink:[] }`. move → card stays linked, subject_id updated; unlink → note_id=null, keeps old subject (becomes standalone).
- Change an attached CARD's subject (`updateMemoryCard(..., unlinkFromNote=true)`): forced unlink (note_id=null + new subject_id). Plain "Unlink" button only nulls note_id.
- `notes.position` is null IFF subject_id is null; move-to-subject sets position=Date.now(), move-to-None nulls it. API must respect this.

API design decisions (recommended defaults, confirm in plan):

1. PATCH /api/notes/:id takes optional `card_actions: { move:[], unlink:[] }`; default when subject changes and no actions given = MOVE ALL cards (note's cards come with it).
2. PATCH /api/memory-cards/:id changing an attached card's subject_id → forced unlink (mirror UI). Document loudly in skill.
