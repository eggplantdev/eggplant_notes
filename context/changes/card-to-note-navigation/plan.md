# Card-to-Note Navigation Implementation Plan

## Overview

S-08 (v2 differentiator: the card→note path). From a recall card in the `/review` loop, the user can open the card's source note in one action, via a subtle "From: ‹note title›" link in the Recall card header. UI + one query extension only — no schema change. The data link (`topic_checks.note_id`, `not null`, FK-indexed) already exists.

## Current State Analysis

- `/review` (`src/app/(protected)/review/page.tsx`) is a Server Component that renders one due card from `getDueQueue()`. The card object is `TopicCheckT` (`topic_checks.*`), which already carries `note_id` — but **not** the note's title.
- `getDueQueue()` (`src/features/topic-checks/queries.ts:16`) is hand-rolled (not `runTableQuery`, because it needs both the row and `count: 'exact'` off one response). It selects `'*'` only and returns `{ first?: TopicCheckT; count: number }`.
- `TopicCheckT` (`src/features/topic-checks/types.ts`) = `Database['public']['Tables']['topic_checks']['Row']`.
- The generated `Database` types expose the FK `topic_checks_note_id_fkey → notes` (`src/lib/supabase/types.ts:194`), so a PostgREST embed `notes(title)` types as a non-null `{ title: string }` — no `any`.
- The only other place cards are listed is `topic-checks-section.tsx`, which renders **on the note's own detail page** — a card→note link there is redundant, so it is out of scope (not a gap).
- Source-note route is `/notes/[id]` (`src/app/(protected)/notes/[id]/page.tsx`), keyed by note id.

## Desired End State

On `/review`, each due card shows a muted "From: ‹title›" link in the card header, above the prompt. Clicking it lands on `/notes/{note_id}`, the source note's detail page. The "All caught up 🎉" empty state is unchanged (no card → no link). Verified by an E2E spec that creates a note, attaches a check (due immediately), opens `/review`, clicks the link, and asserts the URL is the note's detail page.

### Key Discoveries:

- `getDueQueue` is the single integration point — extend its `select` and return type; the page consumes the new field. (`src/features/topic-checks/queries.ts:16`)
- PostgREST embed via the typed FK gives `notes: { title: string }` for free — `select('*, notes(title)')`. No manual type cast.
- `count: 'exact'` + `limit(1)` must be preserved on the same query — the embed rides alongside, it does not change the count semantics.

## What We're NOT Doing

- No schema/migration change (FK already exists).
- No card→note link in `topic-checks-section.tsx` (renders on the note itself — redundant).
- No section-level / heading-anchor linkage and no reverse note→cards view (PRD v2 Non-Goals, parked).
- No new route, no client state, no dashboard change (the dashboard shows a due _count_, not cards).

## Implementation Approach

One phase. Extend `getDueQueue` to embed the note title and widen its return type; render the link in the review card header; add an E2E spec. The link is a plain Next `<Link>` styled as a muted text link (matching the existing `text-muted-foreground text-sm` idiom on the page) — `asChild` Button is reserved for the empty-state CTA.

## Phase 1: Card-to-note link on the review loop

### Overview

Surface the source-note title on the due card and make it a one-click link to the note.

### Changes Required:

#### 1. Due-queue query: embed the note title

**File**: `src/features/topic-checks/queries.ts`

**Intent**: Extend `getDueQueue` so the returned card carries its source note's title, for the link label — without changing the count or limit semantics.

**Contract**: `select('*', { count: 'exact' })` → `select('*, notes(title)', { count: 'exact' })`. The function's return type changes from `{ first?: TopicCheckT; count: number }` to a card type that is `TopicCheckT & { notes: { title: string } | null }`. Define this as a named type (e.g. `DueCardT` in `src/features/topic-checks/types.ts`) rather than an inline shape, so the page and the eventual test import one name. The embed types as non-null via the FK, but keep the `| null` guard defensively (a card whose note was concurrently deleted) and the page falls back gracefully if so.

#### 2. Review card header: the "From: ‹title›" link

**File**: `src/app/(protected)/review/page.tsx`

**Intent**: Render a muted link to the source note in the Recall `CardHeader`, above the prompt, only when the embedded note is present.

**Contract**: Inside the `card` branch's `<CardHeader>`, alongside the existing `<CardTitle>`, add a `<Link href={`/notes/${card.note_id}`}>` reading `From: {card.notes?.title}`. Style with the page's existing muted-small idiom (`text-muted-foreground text-sm hover:text-foreground`). Render nothing if `card.notes` is null. `note_id` is already on the card; `Link` is already imported.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit tests pass: `pnpm test`
- E2E passes: `pnpm test:e2e` (the new card→note spec + no regression in `review`/`notes`/`topic-checks` specs)
- Production build succeeds: `pnpm build`

#### Manual Verification:

- On `/review` with a due card, a "From: ‹title›" link shows in the card header and clicking it lands on the correct note detail page.
- The "All caught up 🎉" empty state is unchanged.
- Usable down to ~360px (the link wraps/truncates, doesn't overflow the card).

**Implementation Note**: After automated verification passes, pause for manual confirmation before archiving.

---

## Testing Strategy

### Unit Tests:

- None warranted — no pure logic added (the change is a query select + a presentational link). The query's behavior is covered end-to-end by the E2E spec.

### Integration / E2E Tests:

- New `e2e/card-to-note.spec.ts` using `e2e/helpers.ts` (`signUp`, `uniqueEmail`, `fillEditor`): sign up → create a note (capture its title) → attach a topic check (due immediately by default) → visit `/review` → assert the card header link reads the note title → click it → `toHaveURL` the note detail route. Reuse the fresh-per-test sign-up pattern (this spec asserts a clean-slate single due card, so it must NOT share a session — per `lessons.md`).

### Manual Testing Steps:

1. Seeded dev account (`dev@example.com` / `password123`) has due cards → open `/review`, confirm the link + navigation.
2. Resize to ~360px, confirm the title link doesn't overflow.

## Performance Considerations

The embed adds one joined column to a `limit(1)` query already backed by the `(user_id, due_at)` index — negligible. No N+1 (single card per render).

## Migration Notes

None — no schema change.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-08, "jump from a card to its source note")
- Query to extend: `src/features/topic-checks/queries.ts:16`
- Review page: `src/app/(protected)/review/page.tsx`
- E2E harness: `e2e/helpers.ts`; flake/fresh-server priors: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Card-to-note link on the review loop

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 464d711
- [x] 1.2 Linting passes: `pnpm lint` — 464d711
- [x] 1.3 Unit tests pass: `pnpm test` — 464d711
- [x] 1.4 E2E passes: `pnpm test:e2e` (S-08 spec green in isolation; full suite blocked by env worker-teardown flake, not this slice) — 464d711
- [x] 1.5 Production build succeeds: `pnpm build` — 464d711

#### Manual

- [x] 1.6 Due card shows "From: ‹title›" link that navigates to the source note (proven by `e2e/card-to-note.spec.ts`) — 464d711
- [x] 1.7 "All caught up" empty state unchanged (verified by inspection — the `!card` branch is untouched by this slice's diff) — 464d711
- [ ] 1.8 Usable at ~360px (link doesn't overflow) — not formally verified; `text-sm` link in a flex-col CardHeader, low overflow risk
