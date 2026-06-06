# Standalone Memory-Card Review Page Implementation Plan

## Overview

Add a standalone card detail page at `/memory-cards/[id]` that the listing links to (replacing today's note-deep-link / edit-page branching). The page reuses the dashboard's `ReviewPanel` so the user can review **any card they pick** — not just the one the FSRS due-queue hands them ("review outside the algorithm"). Rating is a real review (existing `rateMemoryCard` path): updates the FSRS schedule, logs a `review_event`, counts toward the goal. After rating, the user stays on the card and the page refreshes with the new schedule.

## Current State Analysis

- **Review experience is dashboard-only.** `ReviewPanel` (`src/features/review/review-panel.tsx:16`) renders prompt → `<details>` answer → `RatingButtons` with predicted intervals, and already wraps both branches in `ReviewCelebrationProvider` (lessons.md:141-146). It consumes `DueCardT` and takes a `goal` prop. It is **not** dashboard-coupled — reusable as-is.
- **The only entry to review is the due queue.** The dashboard loader (`dashboard/loader.ts:15`) calls `getDueQueue()` (`memory-cards/queries.ts:26`), which returns the single soonest-due card. There is no way to review a specific, non-due card.
- **The listing links elsewhere.** `MemoryCardsList` (`memory-cards/components/memory-cards-list.tsx:23`) routes a linked card to `/notes/[noteId]#card-[id]` and a standalone card to its edit page (`memoryCardEditHref`). No card-detail route exists; `[id]/edit/` is the only `[id]` child route.
- **The rating action is already card-agnostic.** `rateMemoryCard(memoryCardId, rating, goal)` (`review/actions/rate-memory-card.ts:23`) re-fetches the row by id (RLS-scoped), runs FSRS server-side, and persists via the `record_review` RPC — it works on any owned card regardless of due date. It currently `revalidatePath('/dashboard')` only (line 74).
- **An id-by query exists but has the wrong embed.** `getMemoryCard(id)` (`queries.ts:105`) returns `MemoryCardWithSourceT` (`*, notes(id, title)`) for the edit page's Unlink row. `ReviewPanel`/`SourceNoteLink` need `notes(title, subject_id)` (the `DueCardT` shape) — `subject_id`, not `id`. The shapes don't line up, so a dedicated by-id query is cleaner than overloading `getMemoryCard`.

## Desired End State

Clicking any card on `/memory-cards` opens `/memory-cards/[id]`, a `PageShell`-wrapped page (`backHref="/memory-cards"`, matching the sibling edit page) rendering the same review UI as the dashboard for that specific card. The user reveals the answer, rates it, and the page refreshes in place showing the rescheduled state. The per-row Edit button on the listing still reaches the edit page. A not-owned/missing id 404s.

Verify: from the listing, open a card, reveal, rate "Good" → the review is recorded (a `review_events` row, `due_at` advanced) and the page stays on the card with an updated review status. The dashboard due-queue continues to work unchanged.

### Key Discoveries:

- `ReviewPanel` is reuse-ready and already owns the celebration provider — no extraction needed (`review-panel.tsx:16-58`).
- `rateMemoryCard` already operates by id on any card (`rate-memory-card.ts:40-56`); only its revalidation scope needs widening.
- `DueCardT` = `MemoryCardT & { notes: { title; subject_id } | null }` (`memory-cards/types.ts:17`) — the exact shape a new by-id query must return.
- Edit page pattern to mirror: inline `Promise.all` of reads in the page + `notFound()` + `PageShell` (`[id]/edit/page.tsx:11-22`). No separate `loader.ts` needed at this scale.
- Utils are a barrel of single-purpose files (`memory-cards/utils/`) — add `memory-card-href.ts` beside `memory-card-edit-href.ts`.
- Route lessons: run `pnpm exec next typegen` before `pnpm typecheck` (lessons.md:105); stage `[id]/page.tsx` with a `:(literal)` pathspec or via the parent dir (lessons.md:112).
- E2E selectors: default to `data-testid`; scope-then-target repeated list cards, never `.first()` to silence strict mode (lessons.md:119).

## What We're NOT Doing

- No practice/no-op review mode — rating is the real FSRS path, unchanged.
- No new mutation, RPC, schema, or migration.
- No bespoke back control — the standard `PageShell` `backHref` (as the edit page uses) is the only navigation affordance added.
- No change to the dashboard's behavior or to `getDueQueue`.
- No redirect to the listing or dashboard after rating — the user stays on the card.
- No extra on-page context (subject chip, explicit next-due readout) beyond what `ReviewPanel` already renders; the source-note link is shown only when `note_id` is set (handled inside `ReviewPanel`).

## Implementation Approach

Add a by-id query that returns the `DueCardT` shape, a thin server-component page that fans out that query + the daily goal and hands them to the existing `ReviewPanel`, widen `rateMemoryCard`'s revalidation to the card route, and repoint the listing href. The feature is one cohesive phase (Phase 1); the test layer is Phase 2, authored only after the per-slice review gate + `/simplify` per CLAUDE.md.

## Phase 1: Card detail page

### Overview

A new route renders the reused review panel for a specific card; the listing links to it; the rating action refreshes it.

### Changes Required:

#### 1. By-id review query

**File**: `src/features/memory-cards/queries.ts`

**Intent**: Add `getMemoryCardForReview(id)` — fetch one owned card by id in the exact shape `ReviewPanel` consumes, so the page can reuse the dashboard component verbatim. Mirrors `getDueQueue`'s select but keyed by id; missing/not-owned → `undefined` (caller 404s), matching `getMemoryCard`'s contract.

**Contract**: `getMemoryCardForReview(id: string, client?: SupabaseClient<Database>): Promise<DueCardT | undefined>`. Select `'*, notes(title, subject_id)'`, `.eq('id', id).maybeSingle()`. RLS scopes ownership; injectable client per the isolation rule (lessons.md:24). `console.error` + return `undefined` on no row, throw on PostgREST error (follow the existing `getMemoryCard` body).

#### 2. Card href helper

**File**: `src/features/memory-cards/utils/memory-card-href.ts` (+ export from `utils/index.ts`)

**Intent**: Single-purpose helper `memoryCardHref(id)` → `/memory-cards/${id}`, beside `memory-card-edit-href.ts`, so the listing and any future caller share one source of truth for the card route.

**Contract**: `export function memoryCardHref(id: string): string`. Add the re-export line to the utils barrel.

#### 3. Card detail route

**File**: `src/app/(protected)/memory-cards/[id]/page.tsx`

**Intent**: Server component that loads the card + daily goal and renders `ReviewPanel`. 404 on missing/not-owned. Mirrors the edit page's structure (inline `Promise.all`, `notFound()`, `PageShell` with `backHref="/memory-cards"`).

**Contract**: `export default async function MemoryCardReviewPage({ params }: { params: Promise<{ id: string }> })` (Next 16 `params` is a Promise). Fan out `Promise.all([getMemoryCardForReview(id), getDailyGoal()])`; `if (!card) notFound()`; render `<PageShell title="Review card" backHref="/memory-cards" backLabel="Memory cards"><ReviewPanel card={card} goal={goal} /></PageShell>`. `getDailyGoal` from `@/features/settings/queries` (the dashboard loader's source).

#### 4. Widen rating revalidation

**File**: `src/features/review/actions/rate-memory-card.ts`

**Intent**: So the card page refreshes with the new schedule after a rating, revalidate the card route in addition to the dashboard. Additive — the dashboard path is unaffected.

**Contract**: After the existing `revalidatePath('/dashboard')` (line 74), add `revalidatePath(\`/memory-cards/${parsedId.data}\`)` (use the validated id, not the raw input).

#### 5. Repoint the listing href

**File**: `src/features/memory-cards/components/memory-cards-list.tsx`

**Intent**: Every card row links to its detail page instead of branching to the note deep-link or edit page. The per-row Edit/Delete actions stay. Update the now-stale comment block describing the old note-vs-edit branching.

**Contract**: `getHref={(card) => memoryCardHref(card.id)}` (import from the utils barrel; drop the `note_id` ternary). Leave `renderAction` (`CardActions` with `memoryCardEditHref`) unchanged.

### Success Criteria:

#### Automated Verification:

- Typegen + typecheck pass: `pnpm exec next typegen && pnpm typecheck`
- Linting passes: `pnpm lint`
- Build passes: `pnpm build`

#### Manual Verification:

- From `/memory-cards`, clicking any card (linked or standalone) opens `/memory-cards/[id]` showing the review panel for that card.
- Reveal answer works; rating a card records the review and the page refreshes showing an updated review status, staying on the card.
- A linked card shows the source-note link; a standalone card does not.
- The per-row Edit button still opens the edit page; the dashboard due-queue review still works.
- A bogus/other-user id 404s.

**Implementation Note**: After Phase 1's automated verification passes, pause for manual confirmation, then run the per-slice review gate (parallel review fan-out → `/simplify`) BEFORE authoring Phase 2 — per CLAUDE.md the test layer locks in the post-`/simplify` code.

---

## Phase 2: E2E coverage

### Overview

One Playwright spec covering the new public surface: list → open card → reveal → rate → schedule advances. Authored only after the review gate + `/simplify`.

### Changes Required:

#### 1. Card review E2E spec

**File**: `e2e/memory-card-review-page.spec.ts`

**Intent**: Prove the on-demand single-card review flow end-to-end against a fresh production build. Self-seed a card through the real UI (create a card), open it from the listing, reveal the answer, rate it, and assert the review took effect (status/next-due changed, still on the card page).

**Contract**: Fresh-per-test sign-up via `e2e/helpers.ts` (`uniqueEmail`) — this is a mutation spec, so no shared session (lessons.md:38). Locate via `data-testid`, scope-then-target the listing card, never `.first()` (lessons.md:119); add any missing testids to the card row / page in Phase 1's components if needed. Assert on URL (`/memory-cards/[id]`) and the observable rescheduled effect, not on copy.

### Success Criteria:

#### Automated Verification:

- New spec passes: `pnpm test:e2e` (local Supabase stack up; fresh prod build on port 3100)
- Full unit suite passes: `pnpm test`
- Typecheck + lint + build still green: `pnpm exec next typegen && pnpm typecheck && pnpm lint && pnpm build`

#### Manual Verification:

- The spec fails if the listing href regresses to the note/edit branching or if rating no longer reschedules (sanity-check by reverting one Phase 1 change locally).

---

## Testing Strategy

### Unit Tests:

- No new unit-testable pure logic is introduced (the query is a thin PostgREST read; the helper is a one-liner). Existing FSRS/scheduling unit coverage already guards the rating math.

### Integration / E2E Tests:

- Phase 2's spec is the integration signal: real sign-up → create card → open detail page → reveal → rate → assert reschedule.

### Manual Testing Steps:

1. `supabase start`, `pnpm dev`, sign in as `dev@example.com`.
2. Open `/memory-cards`, click a card → lands on `/memory-cards/[id]`.
3. Reveal answer, rate "Good" → page stays, review status updates.
4. Confirm a linked card shows the source-note link; the Edit button still reaches the edit page.
5. Visit `/memory-cards/<random-uuid>` → 404.

## References

- Change identity: `context/changes/memory-card-review-page/change.md`
- Reused component: `src/features/review/review-panel.tsx:16`
- Reused action: `src/features/review/actions/rate-memory-card.ts:23`
- Mirror pattern: `src/app/(protected)/memory-cards/[id]/edit/page.tsx:11`
- Query precedent: `src/features/memory-cards/queries.ts:26` (`getDueQueue`)
- Lessons applied: lessons.md:105 (typegen), :112 (bracket pathspec), :119 (E2E selectors), :141 (celebration provider)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Card detail page

#### Automated

- [x] 1.1 Typegen + typecheck pass: `pnpm exec next typegen && pnpm typecheck` — 738a4d0
- [x] 1.2 Linting passes: `pnpm lint` — 738a4d0
- [x] 1.3 Build passes: `pnpm build` — 738a4d0

#### Manual

- [x] 1.4 Clicking any card opens `/memory-cards/[id]` with the review panel — 738a4d0
- [x] 1.5 Reveal + rate records the review and refreshes in place, staying on the card — 738a4d0
- [x] 1.6 Linked card shows source-note link; standalone does not — 738a4d0
- [x] 1.7 Per-row Edit still opens the edit page; dashboard due-queue still works — 738a4d0
- [x] 1.8 Bogus/other-user id 404s — 738a4d0

### Phase 2: E2E coverage

#### Automated

- [ ] 2.1 New spec passes: `pnpm test:e2e`
- [ ] 2.2 Full unit suite passes: `pnpm test`
- [ ] 2.3 Typecheck + lint + build still green

#### Manual

- [ ] 2.4 Spec fails when a Phase 1 change is reverted (negative sanity check)
