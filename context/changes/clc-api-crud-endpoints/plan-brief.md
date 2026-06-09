# CLC Token API — Full CRUD — Plan Brief

> Full plan: `context/changes/clc-api-crud-endpoints/plan.md`

## What & Why

The CLC personal-token HTTP API can currently only append (create notes/cards) and list titles — it can't read content back, create or edit subjects, update notes/cards, or delete anything. This plan completes the CRUD surface so an agent holding a `clc_` token can fully manage its learning material over HTTP, including switching subjects with the same linked/unlinked card rules the UI enforces.

## Starting Point

Every API route already authenticates via Bearer → minted user JWT → RLS-scoped Supabase client, so ownership is automatic. POST routes reuse injectable cores (`insertNoteWithChecks`); reads are inline RLS selects. But the update logic lives in cookie-session server actions (`updateNote`, `updateMemoryCard`) that also call `revalidatePath`/`toastRedirect` — unusable from an API route. The card subject invariant is app-enforced (no DB trigger).

## Desired End State

Read a note + its cards; list cards by note/subject/unfiled; create/rename/delete subjects; edit notes and cards; switch subjects (move-all default for notes, forced-unlink for attached cards); delete notes (cascades cards) and subjects (unfiles members). The downloadable skill documents every endpoint plus a loud linked/unlinked section, drift-guarded by a pinning test. The UI behaves identically, now delegating to shared cores.

## Key Decisions Made

| Decision                           | Choice                                            | Why                                         | Source |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------- | ------ |
| Reach update logic                 | Extract shared cores                              | Invariant logic lives once; no UI/API drift | Plan   |
| Note subject-move w/o card_actions | Move all cards                                    | Least-surprising "cards come with the note" | Plan   |
| Delete endpoints                   | Included (full CRUD)                              | User opted in                               | Plan   |
| Card PATCH shape                   | Full editable field set (`cardWithSubjectSchema`) | Mirrors the action; no new partial schema   | Plan   |
| Ownership / 404                    | RLS-invisible rows → 404                          | Don't leak existence of other users' rows   | Plan   |
| Forced-unlink / move-all           | Computed in the route, core unchanged             | Keeps UI action behavior byte-identical     | Plan   |

## Scope

**In scope:** GET note-by-id (+cards), GET memory-cards (filters), POST/PATCH/DELETE subjects, PATCH/DELETE notes, PATCH/DELETE cards, core extraction, skill docs + pinning test.

**Out of scope:** schema/migration, new auth, partial card PATCH, bulk ops, list pagination/search, FSRS columns via API.

## Architecture / Approach

App-Router files: collection routes in `route.ts`, per-id in `[id]/route.ts`. New injectable cores (`updateNoteCore`, `updateMemoryCardCore`, `createSubjectCore`, `updateSubjectCore`) sit at the feature root beside existing `insert-*` cores; the server actions become thin wrappers (core + revalidate/redirect). Reads/deletes are inline RLS queries (cascade/SET-NULL are FK-handled). The move-all default and forced-unlink are computed in the route, leaving core behavior identical to today.

## Phases at a Glance

| Phase                             | What it delivers                                                        | Key risk                                                 |
| --------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| 1. Reads + subject CRUD + deletes | GET note/cards, POST/PATCH/DELETE subject, DELETE note/card, skill docs | Low — no invariant logic; mostly inline RLS              |
| 2. Updates + subject-switching    | updateNote/Card cores, PATCH note/card, linked/unlinked skill section   | Core refactor must not regress UI; invariant correctness |

**Prerequisites:** local Supabase up for integration tests; a minted `clc_` token for manual curls.
**Estimated effort:** ~2 sessions (one per phase).

## Open Risks & Assumptions

- Core extraction must be behavior-preserving — the existing `updateNote`/`updateMemoryCard` action tests are the regression guard; if coverage is thin there, add tests before refactoring.
- Move-all default reads linked card ids in the route then calls the core — a card unlinked between the read and the write is a benign no-op (the core's `.eq('note_id', id)` guard filters it).

## Success Criteria (Summary)

- Every endpoint returns documented shapes; 401/404/400 handled; RLS never leaks other users' rows.
- Subject-switching reproduces the UI's move-all / forced-unlink semantics over HTTP.
- UI note/card edit + note-move dialog behave identically after the refactor; all suites + build green.
