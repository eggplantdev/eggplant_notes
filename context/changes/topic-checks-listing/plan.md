# Topic-checks Listing Page Implementation Plan

## Overview

Add a `/topic-checks` page that lists all of the signed-in user's topic-check cards in a flat,
animated card grid, with the same server-side subject filter the notes listing uses. Each card
shows the prompt, its subject + source-note context, and a due/review-status label; clicking a
card jumps to the parent note and scrolls to that exact check. This surfaces the recall set as a
browsable, filterable view and leans into the documented card→note differentiator.

## Current State Analysis

- **Notes listing** (`src/app/(protected)/notes/page.tsx`) is the template: a Server Component that
  parses `?subjects=a,b` → `selectedIds`, runs `Promise.all([getSubjects(), getNotes({ subjectIds })])`,
  and renders `PageShell` (title + post-filter count subtitle) → `NotesFilter` → `NotesList`, with
  separate empty states for "nothing yet" and "nothing matches filter".
- **Subject filter** (`src/features/notes/components/notes-filter.tsx`) is a client component over
  `MultiSelect` with local-while-open + debounced `router.replace` + URL-synced-when-closed selection,
  and renders the selected-subject chips with ×-to-remove. It is already generic — only the name and
  location are notes-specific.
- **topic_checks** link to notes via `note_id`; notes link to subjects via `subject_id`. There is no
  direct subject FK, so subject filtering must join through notes. `getDueQueue` already embeds
  `notes(title)` via the topic_checks→notes FK (`src/features/topic-checks/queries.ts:25`).
- **`state`** is a `smallint` (0=New, 1=Learning, 2=Review, 3=Relearning); `due_at` is a timestamp.
  No helper formats either into a display label today (confirmed across `src/`).
- **Note detail check list** (`src/features/topic-checks/topic-checks-section.tsx:45`) server-renders
  each check as an `<li key={check.id}>` with no `id` attribute; the page already uses native anchors
  (`#topic-check-form`).
- Shared date utils live at `src/lib/utils/date.ts` (`MS_PER_DAY`, `APP_TIME_ZONE`); no relative-time
  formatter exists yet.

## Desired End State

Navigating to `/topic-checks` (via a new nav entry) shows every owned check as a card grid, newest-due
first. A subjects multiselect filters the list server-side via `?subjects=`, with selected-subject chips
and a live post-filter count in the header — identical behavior to the notes page. Each card shows the
prompt (title), a subject chip + source-note title, and a due/review status label. Clicking a card opens
`/notes/[noteId]#check-[id]` and scrolls to that check. The existing notes page is unchanged in behavior
after the filter component is relocated.

Verify: load `/topic-checks` with seeded data → cards render due-first; pick a subject in the filter →
URL gains `?subjects=…`, list re-queries to only that subject's checks, chip + count update; clear it →
full list returns; click a card → lands on the note scrolled to the matching check.

### Key Discoveries:

- Notes page pattern to mirror: `src/app/(protected)/notes/page.tsx:14-61`.
- Filter component to promote (already generic): `src/features/notes/components/notes-filter.tsx`.
- Embed/filter contract: `notes!inner(...)` is required so PostgREST can filter on the embedded
  `subject_id`; an outer join cannot filter. `.in('notes.subject_id', subjectIds)`.
- Existing FK embed precedent: `src/features/topic-checks/queries.ts:25` (`notes(title)`).
- Native anchor precedent: `src/features/topic-checks/topic-checks-section.tsx:51` (`#topic-check-form`).

## What We're NOT Doing

- No topic-check detail route (`/topic-checks/[id]`) — clicking goes to the parent note.
- No per-subject grouped sections — flat list + filter only, exact notes mirror.
- No DB migration or schema change — read-only over existing tables (the only mutation is the
  existing `deleteTopicCheck`, now also revalidating `/topic-checks`).
- No client scroll effect / highlight — native hash scroll + `scroll-mt` only.

### Scope added mid-implementation (user request, 2026-06-05)

- **Edit/delete on cards** — originally out of scope; the list now carries per-card Edit + Delete
  (reusing `DeleteTopicCheckButton`; `deleteTopicCheck` revalidates `/topic-checks` too), mirroring
  the notes cards. Edit jumps to the parent note's check-edit form.
- **Bottom-aligned card subtitle** — `AnimatedCardList` now pins `renderSubtitle` to the card
  bottom (`mt-auto`) and uses the shadcn `CardAction` slot, so tags line up across a grid row.
  Applies to all shared cards (notes, subjects, topic-checks) per the user's choice.
- No test-authoring in these phases — per the project review gate, tests are written after
  review + `/simplify`, against the cleaned-up code (see Testing Strategy).

## Implementation Approach

Build in three phases, smallest-blast-radius first: (1) the read query + type + status helper (pure
additions, independently verifiable); (2) promote the filter component to the subjects feature and
repoint the notes page (refactor with no behavior change); (3) the page, list component, card anchors,
and nav entry that compose it all. Each phase type-checks and lints green before the next.

## Phase 1: Data layer — filtered query, list-item type, status helper

### Overview

Add the server read that powers the page and the helper that formats review status, with no UI yet.

### Changes Required:

#### 1. Filtered list query

**File**: `src/features/topic-checks/queries.ts`

**Intent**: Add `getTopicChecksList({ subjectIds }?)` returning every owned check with its source-note
title and subject, optionally narrowed to selected subjects, ordered soonest-due first so the list
doubles as a study-readiness view. Injectable client per the project isolation rule.

**Contract**: `getTopicChecksList(opts?: { subjectIds?: string[] }, client?: SupabaseClient<Database>): Promise<TopicCheckListItemT[]>`.
Select `'*, notes!inner(title, subject_id, subjects(title))'`; when `subjectIds?.length`, apply
`.in('notes.subject_id', subjectIds)`; `.order('due_at', { ascending: true })`. Use `runTableQuery`
(rows-only, like `getTopicChecksForNote`). `notes!inner` is load-bearing — a plain `notes(...)` embed
cannot be filtered by `.in('notes.subject_id', …)`.

#### 2. List-item type

**File**: `src/features/topic-checks/types.ts`

**Intent**: Add the row type for the listing — a check plus the joined note title, note subject_id, and
subject title needed for the card's context line and the card→note href.

**Contract**: `export type TopicCheckListItemT = TopicCheckT & { notes: { title: string | null; subject_id: string; subjects: { title: string } | null } | null }`.
Keep `notes` and `subjects` defensively `| null`, mirroring `DueCardT` (types.ts:10).

#### 3. Review-status label helper

**File**: `src/features/topic-checks/utils/format-review-status.ts` (+ `src/features/topic-checks/utils/index.ts` barrel)

**Intent**: Map a check's FSRS `state` + `due_at` to a short human label for the card (e.g. "New",
"Learning", "Due today", "Overdue", "Due in 3d"). Pure function, no React.

**Contract**: `formatReviewStatus(input: { state: number; due_at: string }): string`. Use an
`as const` map for the four states (0 New, 1 Learning, 2 Review, 3 Relearning) — no `enum`. For
review/relearning (or generally when scheduled), derive relative due text from `due_at` vs now using
day math (`MS_PER_DAY` from `@/lib/utils/date`): past → "Overdue", same day → "Due today", else
"Due in Nd". New/learning states surface their state label. Keep helper under ~20 lines.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- (none — no UI yet; validated via Phase 3)

**Implementation Note**: After automated verification passes, proceed to Phase 2 (no manual step here).

---

## Phase 2: Promote the subject filter to the subjects feature

### Overview

Relocate the generic filter from the notes feature to the subjects feature (its natural domain, now
that a 2nd consumer exists) and repoint the notes page. Behavior unchanged.

### Changes Required:

#### 1. Move + rename the filter component

**File**: `src/features/subjects/components/subject-filter.tsx` (moved from `src/features/notes/components/notes-filter.tsx`)

**Intent**: Make the subject filter shared domain code. Rename the export `NotesFilter` → `SubjectFilter`
and the props type `NotesFilterPropsT` → `SubjectFilterPropsT`; logic, debounce, chips, and URL wiring are
unchanged. Update the doc comment so it no longer says "notes list" specifically.

**Contract**: `export function SubjectFilter({ options, selectedIds }: SubjectFilterPropsT)`, same props
shape (`{ options: MultiSelectOptionT[]; selectedIds: string[] }`) and same `?subjects=` URL contract.

#### 2. Repoint the notes page import

**File**: `src/app/(protected)/notes/page.tsx`

**Intent**: Import `SubjectFilter` from its new subjects-feature location and use it in place of
`NotesFilter`. No other change.

**Contract**: `import { SubjectFilter } from '@/features/subjects/components/subject-filter'`; replace the
`<NotesFilter … />` usage (page.tsx:41).

### Success Criteria:

#### Automated Verification:

- No dangling references to the old path: `grep -rn "notes-filter\|NotesFilter" src` returns nothing
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- The notes page filter still behaves exactly as before (open multiselect, pick subjects, chips +
  count update, URL gains `?subjects=`, clear restores the full list).

**Implementation Note**: After automated verification passes, pause for manual confirmation that the
notes filter still works before proceeding to Phase 3.

---

## Phase 3: Topic-checks page, list, card anchors, and nav

### Overview

Compose the page from the Phase 1 data + Phase 2 filter, add the list component and source-note anchors,
and add the nav entry.

### Changes Required:

#### 1. The page

**File**: `src/app/(protected)/topic-checks/page.tsx`

**Intent**: Server Component mirroring `NotesPage`: parse `?subjects=` → `selectedIds`, fetch
`Promise.all([getSubjects(), getTopicChecksList({ subjectIds: selectedIds })])`, render `PageShell`
(title "Topic checks", `width="full"`, subtitle = post-filter count) → `SubjectFilter` (when subjects
exist) → `TopicChecksList`, with the two empty states (none yet / none match filter).

**Contract**: `export default async function TopicChecksPage({ searchParams }: { searchParams: Promise<{ subjects?: string }> })`.
Subtitle: `${list.length} topic check${list.length === 1 ? '' : 's'}`. No "new" action button (creation
lives in the note detail).

#### 2. The list component

**File**: `src/features/topic-checks/components/topic-checks-list.tsx`

**Intent**: Thin client wrapper over `AnimatedCardList` (`gridLayout`), mirroring `NotesList`. Supplies
the card href, title (the prompt), and a subtitle composed of the subject chip + source-note title +
status label. No per-card delete dialog (unlike notes).

**Contract**: `export function TopicChecksList({ checks }: { checks: TopicCheckListItemT[] })`.
`getKey` = `check.id`; `getHref` = `/notes/${check.note_id}#check-${check.id}`; `renderTitle` =
`check.prompt`; `renderSubtitle` renders the subject chip (reuse the notes-list chip classes:
`bg-muted text-foreground … rounded px-1.5 py-0.5 text-xs font-medium`) + note title +
`formatReviewStatus(check)`.

#### 3. Source-note card anchors

**File**: `src/features/topic-checks/topic-checks-section.tsx`

**Intent**: Make each check on the note detail a scroll target so the card→note jump lands on the right
check. Add `id="check-<id>"` and a top scroll margin to each `<li>` so the sticky nav doesn't overlap it.

**Contract**: On the `<li>` (line 46) add `id={`check-${check.id}`}` and a `scroll-mt-24` (or matching
nav-height) class. No behavior change to edit/delete.

#### 4. Nav entry

**File**: the app nav (e.g. `src/components/app-nav/…`)

**Intent**: Add a "Topic checks" link to `/topic-checks` alongside the existing Notes link, following the
existing nav-item pattern.

**Contract**: New nav item `{ href: '/topic-checks', label: 'Topic checks' }` (match the existing item
shape/active-state handling).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build passes: `pnpm build`

#### Manual Verification:

- `/topic-checks` lists all seeded checks, soonest-due first, each showing prompt + subject + note title
  - status label.
- Selecting a subject filters the list server-side (URL `?subjects=`), updates chips + count; clearing
  restores the full list; selecting multiple subjects batches into one re-query.
- Empty states render correctly (no checks at all vs no checks match the filter).
- Clicking a card opens its parent note scrolled to the matching check (`#check-<id>`); the sticky nav
  does not cover the check.
- The nav "Topic checks" link works and shows active state on the page.

**Implementation Note**: After automated verification passes, pause for manual confirmation. If native
hash scroll proves unreliable on cross-document navigation, revisit the anchor decision (client scroll
effect fallback) — flagged in Open Risks.

---

## Testing Strategy

Per the project per-slice review gate, automated tests are authored AFTER review + `/simplify`, against
the cleaned-up code — not in the implementation phases above. When that step comes:

### Unit Tests (Vitest):

- `formatReviewStatus`: each state label (0–3); overdue / due-today / due-in-Nd boundaries around now.

### E2E (Playwright, mirroring the notes-filter spec):

- Self-seed via UI: create a subject + note + topic check.
- Load `/topic-checks` → the check appears.
- Apply a subject filter via the multiselect → only matching checks remain; count + chip update.
- Clear the filter → full list returns.
- Click a card → lands on `/notes/[noteId]` with the check scrolled into view.

### Manual Testing Steps:

1. Seed via `supabase db reset` (dev accounts) or create data through the UI.
2. Walk the Phase 3 manual-verification list above.

## Performance Considerations

Personal-scale data; fetching all owned checks is fine (same assumption as `getChecksForStats`). The
`(user_id, due_at)` index backs the `order('due_at')`. The subject filter re-queries on change (debounced
to one round-trip per popover session), identical to notes.

## Migration Notes

None — read-only over existing tables; no schema change.

## References

- Notes listing pattern: `src/app/(protected)/notes/page.tsx`
- Filter to promote: `src/features/notes/components/notes-filter.tsx`
- FK embed precedent: `src/features/topic-checks/queries.ts:25`
- Native anchor precedent: `src/features/topic-checks/topic-checks-section.tsx:51`
- Shared date utils: `src/lib/utils/date.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data layer — filtered query, list-item type, status helper

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — b08e0fe
- [x] 1.2 Linting passes: `pnpm lint` — b08e0fe

### Phase 2: Promote the subject filter to the subjects feature

#### Automated

- [x] 2.1 No dangling references to the old path (`grep -rn "notes-filter\|NotesFilter" src` empty) — 23a97ed
- [x] 2.2 Type checking passes: `pnpm typecheck` — 23a97ed
- [x] 2.3 Linting passes: `pnpm lint` — 23a97ed

#### Manual

- [ ] 2.4 Notes page filter still behaves exactly as before

### Phase 3: Topic-checks page, list, card anchors, and nav

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 8521677
- [x] 3.2 Linting passes: `pnpm lint` — 8521677
- [x] 3.3 Production build passes: `pnpm build` — 8521677

#### Manual

- [ ] 3.4 `/topic-checks` lists all checks, due-first, with prompt + subject + note title + status
- [ ] 3.5 Subject filter narrows server-side; chips + count update; clear restores; multi-select batches
- [ ] 3.6 Empty states render correctly (none yet vs none match filter)
- [ ] 3.7 Card click opens parent note scrolled to the matching check; sticky nav doesn't cover it
- [ ] 3.8 Nav "Topic checks" link works and shows active state
