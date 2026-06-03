# Card-to-Note Navigation — Plan Brief

> Full plan: `context/changes/card-to-note-navigation/plan.md`

## What & Why

S-08, the v2 differentiator (the card→note path): keep each recall card bound to its source note so knowledge stays linked. From a due card in `/review`, the user opens its source note in one click, via a "From: ‹note title›" link.

## Starting Point

`/review` renders one due card (`getDueQueue()` → `topic_checks.*`). The card carries `note_id` but not the note title, and there is no link to the note. The FK `topic_checks.note_id → notes` already exists (`not null`, indexed).

## Desired End State

Each due card shows a muted "From: ‹title›" link in its header; clicking it lands on `/notes/{note_id}`. Empty state unchanged.

## Key Decisions Made

| Decision       | Choice                                | Why                                                             | Source |
| -------------- | ------------------------------------- | --------------------------------------------------------------- | ------ |
| Link label     | Note title ("From: ‹title›")          | More meaningful than a generic link; worth the small query join | Plan   |
| Placement      | Card header, subtle, above prompt     | Always-in-view + discoverable; title ≠ answer, minimal spoiler  | Plan   |
| Query strategy | Embed `notes(title)` in `getDueQueue` | Single integration point; FK-typed embed, no `any`              | Plan   |
| Other surfaces | Review loop only                      | Per-note card list renders on the note itself — link redundant  | Plan   |

## Scope

**In scope:** extend `getDueQueue` select + return type; add the header link on `/review`; one E2E spec.

**Out of scope:** schema change; link in `topic-checks-section.tsx`; heading-anchor linkage; reverse note→cards view; dashboard change.

## Architecture / Approach

One phase. `getDueQueue` gains `select('*, notes(title)')` and a `DueCardT = TopicCheckT & { notes: { title: string } | null }` return type; the Server Component reads `card.notes?.title` and renders a `<Link>`. No client state, no new route.

## Phases at a Glance

| Phase                                   | What it delivers                          | Key risk                                   |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| 1. Card-to-note link on the review loop | Title link on the due card + E2E coverage | Embed return-type shape; E2E sign-up flake |

**Prerequisites:** S-02 (done — `topic_checks.note_id`), S-03 (done — `/review` loop).
**Estimated effort:** ~1 short session, single phase.

## Open Risks & Assumptions

- Embed types as non-null `{ title: string }`, but the plan keeps a `| null` guard for a concurrently-deleted note.
- Local-stack E2E sign-up flake is pre-mitigated by `retries: 2` + fresh-per-test sign-up (`lessons.md`); this spec must not share a session (asserts a clean single due card).

## Success Criteria (Summary)

- On `/review`, a due card links to its source note by title and navigation works.
- Empty state unchanged; layout holds at ~360px.
- `pnpm typecheck`/`lint`/`test`/`test:e2e`/`build` green.
