---
project: 'Coding Learning Companion'
version: 2
status: draft
created: 2026-06-03
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: 2026-06-10
  after_hours_only: true
---

# Coding Learning Companion — Product Requirements (v2, brownfield re-shape)

> v2 re-shapes the live product after dogfooding revealed the real shape of the
> user's notes. v1 (greenfield) PRD is preserved at `context/foundation/prd.md`.
> Shape input: `context/foundation/shape-notes.md`.

## Current System Overview

A personal coding-learning web app: markdown notes with syntax-highlighted code, plus spaced-repetition recall cards attached to those notes.

- **Architecture:** serverless web application, App Router, deployed on a managed hosting platform.
- **Tech stack:** Next.js 16 (App Router) + React 19 + TypeScript; Tailwind v4 + shadcn/ui; Supabase (Postgres + Auth + Row-Level Security); Vercel. Bring-your-own-key LLM access via OpenRouter PKCE.
- **Current user base:** the operator only (user zero, dogfooding). No real external users and no real notes/cards entered in the app yet.
- **Core functionality today:** email+password auth; per-user persistent notes with code highlighting; a spaced-repetition recall loop (FSRS) over cards (`memory_cards`) each attached to a note; account-and-data deletion. Per-user isolation enforced at the persistence layer (RLS).

## Problem Statement & Motivation

The live product treats a note as a flat, standalone, ungrouped record. Dogfooding against the operator's real learning notes shows a different shape: knowledge is organized into **subjects** (e.g. "React/Next"), each subject is a long document split into note-sized sections, and each note spawns recall cards and references code examples. Today those artifacts live in four disconnected places and three formats, with no path from a recall card back to the note section it came from.

This change is timely because the original ship deadline now has comfortable slack, so scope can expand from "flat notes" toward the structure the user actually keeps. The current workaround — markdown files scattered across repositories plus separately-generated recall cards that leave the app entirely — costs the user findability and breaks the link between a card and its source. The differentiator a filesystem cannot provide is keeping a card bound to its source note inside one system, with a card→note navigation path.

## User & Persona

Unchanged from v1. Primary persona: a solo developer managing their own coding-learning notes across many languages and projects, who wants one place to keep notes, recall cards, and examples and to navigate between them. Flat single role; the system is multi-user (others may sign up) but each person owns only their own data. The operator is user zero and the adoption test.

## Success Criteria

### Primary

- The operator stops opening external markdown files and uses the app instead for at least one real subject. End-to-end: create a subject → add notes to it as ordered sections → read the subject as one continuous document → recall cards attached to a note surface in the due-review loop → after reviewing a card, jump directly to its source note. Adoption-by-dogfooding is the bar, not feature count.

### Secondary

- Inline recall-card creation during note authoring, and small authoring refinements (no validation error shown while typing; language selection when creating a note), land as fast-follow after the deadline and make daily authoring smooth enough to sustain use.

### Guardrails

- Per-user data isolation must not regress: no user can ever read or write another user's data.
- The recall loop must keep surfacing due cards at the right time and rescheduling correctly after a review — finishing it must not break it.
- The structural change may be made cleanly (no real data to preserve), but must not leave the recall loop or the isolation guarantee in a broken state.

## User Stories

### US-01: Organize notes into a subject and read it as one document

- **Given** a signed-in user with several notes
- **When** they create a subject, assign notes to it, order those notes, and open the subject
- **Then** they see all member notes rendered as one continuous, ordered document, while each note remains individually openable and editable

#### Acceptance Criteria

- A note may belong to one subject or to none (unassigned notes remain valid).
- Note order within a subject is user-controlled and persists across sessions.
- From any due card in the review loop, the user can navigate directly to that card's source note.
- Previously this was impossible: notes were flat and ungrouped, and there was no in-app navigation from a card to its note.

## Scope of Change

- **[new]** Subjects: a grouping layer above notes. A user can create a subject with a title, assign notes to it, leave notes unassigned, and reorder notes within a subject.
- **[new]** Subject-as-document reading: a subject renders its member notes in order as one continuous document, each note still individually addressable.
- **[new]** Card→note navigation: from a recall card (in the due-review loop and in card lists) the user can open the card's source note. The underlying association between a card and its note already exists; only the navigation path is added.
- **[modified]** Recall loop completion: finish the spaced-repetition review flow so due cards surface and self-rated reviews reschedule correctly.
- **[preserved]** Per-user data isolation must continue to hold across the new subject grouping.
- **[preserved]** The existing recall scheduling behavior must continue to work unchanged except for completion.

**Fast-follow (post-deadline, not in the must-ship subset):**

- **[new]** Attach recall cards inline while creating or editing a note, in one flow (no redirect-first).
- **[modified]** Defer title validation so no error appears while the user is still typing.
- **[new]** Select a code language when creating a note.

## Constraints & Compatibility

- **No data to preserve:** no real users or notes exist in the app yet, so the structural change carries no compatibility or data-preservation burden and may be made cleanly.
- **Must not regress:** the per-user isolation guarantee and the recall-loop scheduling behavior.
- **Stack unchanged:** no change to the runtime, hosting, auth method, or LLM-access model; this is an additive structural change within the existing system.

## Business Logic Changes

No domain-rule change. The existing rule — the system decides _when_ a piece of knowledge should resurface for review, based on the user's past recall performance — is unchanged.

This change adds an **organizational layer** (grouping notes into subjects, ordered subject-as-document reading, and card→note navigation). It is structure, not a new domain decision: the must-ship subset introduces no new scoring, recommendation, or classification rule.

## Access Control Changes

No access control changes — current model preserved. Email+password sign-in, flat single role, per-user ownership of all data, and bring-your-own-key LLM access all carry forward unchanged.

## Non-Goals

- **Section-level card→note linkage** — v2 navigation jumps to the source note, not to a specific heading within it. (Deferred to a later iteration.)
- **AI verification of code examples** — examples remain plain content for now; automated grading is out of scope for this change.
- **Exporting recall cards out of the app** — cards stay in-app for this change; making them leave as an optional output is a later iteration.
- **Auth or role-model changes** — the flat, single-role model is explicitly unchanged.
- **Team, sharing, or admin features** — this remains a single-person personal tool.

## Open Questions

1. **How should note order within a subject be represented so that reordering and inserting between two notes stay cheap?** — Owner: implementation planning. Block: no.
2. **When a note has no subject, does it remain a free-floating unassigned note, or is it auto-placed into a default catch-all subject?** — Owner: implementation planning. Block: no.
3. **When a subject is deleted, what happens to its member notes — do they detach and survive, or are they removed with it?** — Owner: implementation planning. Block: no.
4. ~~**Documentation drift:** project docs describe the recall algorithm as SM-2, but the implemented scheduling is FSRS.~~ **Resolved 2026-06-03:** reconciled to FSRS — `tech-stack.md` + `shape-notes.md` updated; `lessons.md` had no SM-2 refs; CLAUDE.md's SM-2 mentions are accurate transition history (left as-is).
