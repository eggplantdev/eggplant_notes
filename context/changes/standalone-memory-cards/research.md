---
date: 2026-06-06T15:04:37Z
researcher: ex-Plant
git_commit: 63502ee539f8bb1d318479103cb33654cd8dd438
branch: main
repository: 10x_devs
topic: 'Create memory cards directly without first authoring a note (standalone-card entry point)'
tags: [research, codebase, memory-cards, notes, subjects, data-model, server-actions]
status: complete
last_updated: 2026-06-06
last_updated_by: ex-Plant
---

# Research: Standalone memory-card creation

**Date**: 2026-06-06T15:04:37Z
**Researcher**: ex-Plant
**Git Commit**: 63502ee539f8bb1d318479103cb33654cd8dd438
**Branch**: main
**Repository**: 10x_devs

## Research Question

We can only add memory cards from inside a note today. We want a "New card" entry point — on the dashboard next to "New note", and on the memory-cards surface — that creates a card directly, where the user only picks a Topic/Subject. Can a card exist without a note, or must we auto-create a backing note? What's the minimal, convention-fitting way to wire this?

## Summary

**A memory card cannot exist without a note.** `memory_cards.note_id` is `NOT NULL` with `FK → notes(id) ON DELETE CASCADE`. So the user's fallback instinct is the correct (and only) design: the standalone flow **auto-creates a backing note** and attaches one card to it.

**The infrastructure for this already exists.** The RPC `create_note_with_checks(p_note jsonb, p_checks jsonb)` was built precisely because "a check cannot exist before its note" — it inserts a note, captures its id, and inserts N cards against it, all in one transaction. The standalone-card flow is just this RPC called with **one** check and a chosen `subject_id`. No new migration, no schema change, no nullable-FK refactor.

So the whole feature is: **two new entry-point buttons + one thin create-flow that reuses the existing RPC, the existing single-select subject `Combobox`, and the existing card form fields.** No data-model change.

## Detailed Findings

### Data model — the hard constraint

- `memory_cards` table — `supabase/migrations/20260603070945_init_notes_memory_cards_review_events.sql:46-57`. `note_id uuid not null references notes(id) on delete cascade` (line 49). Required at insert: `note_id`, `prompt`. All FSRS columns (`stability`, `difficulty`, `state`, `due_at`, …) have defaults (a fresh card with `state=0`/`due_at=now()` is immediately valid). `example`/`code_context` nullable (`20260603104838_add_topic_check_content_columns.sql:7-8`).
- `notes` table — `…20260603070945…:9-16` + `20260603151508_add_subjects_and_note_ordering.sql:49-50`. Minimum insert: nothing strictly required beyond defaults — `content` is `NOT NULL DEFAULT ''`, `title` nullable, `subject_id` nullable FK → subjects `ON DELETE SET NULL`, `position` nullable. So a backing note can be created with **just a `subject_id`** (or even nothing).
- `subjects` table — `20260603151508…:13-20`. `title not null`; this is the "Topic" the user selects.
- RLS — all three tables scope every row by `(select auth.uid()) = user_id` (`…20260603070945…:22-80`). Notes INSERT/UPDATE additionally enforce that any `subject_id` is owned by the caller (`20260603151508…:59-86`) — cross-user subject assignment is rejected at the DB.

### The reusable RPC — `create_note_with_checks`

- `supabase/migrations/20260603180614_create_note_with_checks_rpc.sql:16-44`. `security invoker`, reads note columns explicitly (no mass-assignment), leaves `user_id` to the `auth.uid()` default, returns the new note id. Granted to `authenticated` only (lines 46-47).
- Header comment (lines 1-15) states the exact rationale: "memory_cards.note_id is NOT NULL FK, so a check cannot exist before its note. This RPC inserts the note … inserts each staged check … all in one transaction (all-or-nothing)." **This is the standalone-card primitive, already shipped.**

### How a card is created today (note-coupled)

- Action `createMemoryCard(noteId, input)` — `src/features/memory-cards/actions/create-memory-card.ts:15`. `noteId` is a **required parameter**, never form input; inserts `{ note_id, ...data }`, revalidates `/notes/${noteId}` and `/memory-cards`.
- Schema `memoryCardInputSchema` — `src/features/memory-cards/schemas.ts:16-20`: `{ prompt (required, 1–2000 chars), example (optional/nullable), code_context (optional/nullable) }`. IDs validated with `z.guid()` (shape-only), not `z.uuid()` — see lessons.
- Form `MemoryCardForm({ noteId, card?, onClose })` — `src/features/memory-cards/memory-card-form.tsx:34`. Uses TanStack `useAppForm` (`src/components/forms/hooks/form-hooks.ts:8`). Always mounted inside a note page via `MemoryCardsSection` (`memory-cards-section.tsx:23`) → `AddMemoryCard` (`add-memory-card.tsx:15`), which receives `noteId` from `notes/[id]/page.tsx:95-99`. **There is no card-create path that isn't bound to an existing note.**

### Note-creation flow (the pattern to mirror)

- Route `src/app/(protected)/notes/new/page.tsx:1-23` — Server Component reads `?subject=<id>`, fetches subjects, validates the preselect, passes `createNote` + subjects + `defaultSubjectId` to `NoteForm`.
- Action `createNote` — `src/features/notes/actions/create-note.ts:22-39` — validates `createNoteWithChecksSchema`, calls the `create_note_with_checks` RPC (line 28), revalidates `/notes`, redirects to `/notes/{newId}`.
- Subject picker (single-select) — `src/features/notes/note-form.tsx:110-125`: `Combobox` from `@/components/ui/combobox`, `options: {value,label}[]`, `NO_SUBJECT = 'none'` sentinel (line 25). **This is the exact "pick a Topic" control the standalone flow needs — reuse it.**

### Entry points

- Dashboard "New note" — `src/app/(protected)/dashboard/page.tsx:48`: `actions={<ButtonLink href="/notes/new">New note</ButtonLink>}` via `PageShell`'s `actions` prop. Add a second `ButtonLink` here.
- Memory-cards surface — route `/memory-cards` (`src/app/(protected)/memory-cards/page.tsx`), in nav `src/components/app-nav/nav-items.ts:3-8` (`{ href: '/memory-cards', label: 'Memory cards' }`). No `/review` or `/cards` route — review is embedded on the dashboard via `ReviewPanel`. A "New card" button belongs in this page's `PageShell` actions.
- `PageShell` — `src/components/layout/page-shell.tsx`: `actions` prop renders top-right; `width` 'full'|'prose'|'wide' ('wide' used by the note editor).

## Code References

- `supabase/migrations/20260603070945_init_notes_memory_cards_review_events.sql:46-57` — memory_cards; `note_id NOT NULL FK` is the load-bearing constraint
- `supabase/migrations/20260603180614_create_note_with_checks_rpc.sql:16-44` — the atomic note+cards RPC to reuse
- `supabase/migrations/20260603151508_add_subjects_and_note_ordering.sql:49-50,59-86` — notes.subject_id + subject-ownership RLS
- `src/features/memory-cards/actions/create-memory-card.ts:15` — current note-coupled create action
- `src/features/memory-cards/schemas.ts:8-20,28-29` — card input schema + id schemas
- `src/features/memory-cards/memory-card-form.tsx:34-132` — the card form to reuse fields from
- `src/features/notes/actions/create-note.ts:22-39` — RPC-calling action pattern to mirror
- `src/features/notes/note-form.tsx:110-125` — single-select subject `Combobox` to reuse
- `src/app/(protected)/notes/new/page.tsx:1-23` — `/…/new` route pattern to mirror
- `src/app/(protected)/dashboard/page.tsx:48` — where the second entry-point button goes
- `src/app/(protected)/memory-cards/page.tsx` + `src/components/app-nav/nav-items.ts:3-8` — memory-cards surface + nav

## Architecture Insights

- **No new migration needed.** Reusing `create_note_with_checks` keeps the cascade chain (`notes → memory_cards → review_events`) and all RLS intact. A nullable-`note_id` alternative would force re-thinking the cascade, the `/memory-cards` listing join (`MemoryCardListItemT` joins note title + subject), and every card→note navigation — strictly worse for an MVP.
- **The card→note path is the product differentiator** (per CLAUDE.md). Auto-creating a backing note preserves it: a standalone card still lands on a real note page, just one the system authored.
- **Mirror, don't invent.** A new `/memory-cards/new` route + a small `StandaloneCardForm` (subject `Combobox` + the existing prompt/example/code_context fields) + a `createStandaloneCard` action that calls the RPC with one check. This reuses the existing schema, form primitives, and RPC.

## Historical Context (from prior changes)

- The card-content columns (`example`, `code_context`) and the `create_note_with_checks` RPC came from the F-02 / topic-checks work — the "checks attached to a note" model. Standalone cards are the inverse entry point into the same model.
- Lessons that will bite implementation: `z.guid()` not `z.uuid()` for DB ids; `updated_at` is DB-owned (moddatetime trigger — never hand-stamp); E2E `data-testid` selectors; multi-editor pages need scoped `fillEditor`; route add → run `next typegen` before `typecheck`; bracket route paths need `:(literal)` for git.

## Open Questions (for /10x-plan to resolve)

1. **Backing-note title/content.** A standalone card spawns a note. What is that note's `title`? Options: (a) `null` (note list shows "Untitled"), (b) derive from the card prompt (truncated), (c) a fixed label like "Quick card". `content` defaults to `''`. This affects how these notes read in `/notes` and `/memory-cards`.
2. **Do auto-created notes pollute `/notes`?** They'll appear in the notes list and count. Acceptable for MVP, or should they be visually/structurally distinguished (the `is_seeded` marker is unrelated; there's no "cardless" flag today)? Adding a flag = a migration; not adding one = simplest.
3. **Is Topic/Subject required or optional in the standalone form?** `subject_id` is nullable, so we _can_ allow "no subject". The change note says "only allow to select a topic" — likely required, but confirm.
4. **Post-create destination.** After creating, redirect to the new note page (`/notes/{id}`, consistent with `createNote`), to `/memory-cards`, or back to the dashboard?
5. **Route + entry naming.** `/memory-cards/new` (consistent with the `/memory-cards` surface + nav) vs `/cards/new`. Label "New card".

## Decisions (resolved with user, 2026-06-06)

> **SUPERSEDED (later same day):** items 2–6 below described an _auto-create backing note_ approach (model A). During planning the user rejected that in favor of **decoupling cards from notes** (model B): `note_id` becomes nullable and a card owns its own `subject_id` (single source), with linked-card subjects synced to their note via DB triggers. The authoritative decisions now live in `plan.md` / `plan-brief.md`. Only item 1 (subject optional) and the no-backfill stance survived unchanged. Kept here for lineage.

1. **Topic/Subject is OPTIONAL** in the standalone form. `subject_id` is nullable; a card may be created unfiled (backing note has `subject_id = null`). Reuse the `Combobox` with the `NO_SUBJECT` sentinel — same as `NoteForm`.
2. **Backing-note title = derived from the card prompt** (truncated; pick a sane cap, e.g. ~80 chars, single line). `content` stays `''`.
3. **No "cardless note" flag, no migration.** Auto-created notes appear as normal notes in `/notes`. Accept for MVP.
4. **After create → redirect to `/memory-cards`** (the cards listing), where the new card appears. (Standalone flow differs from `createNote`, which redirects to the note page.)
5. **Explainer copy inside the create-card UI** (new requirement): describe both paths — (a) attach a card to an existing note by selecting one from `/notes`, or (b) create a standalone card here and a note is created for it automatically. Keep it short, near the form.
6. Route: `/memory-cards/new`; entry buttons labelled "New card" on the dashboard (next to "New note") and on the `/memory-cards` page header.
