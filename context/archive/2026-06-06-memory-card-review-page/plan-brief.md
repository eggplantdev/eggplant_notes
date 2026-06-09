# Standalone Memory-Card Review Page — Plan Brief

> Full plan: `context/changes/memory-card-review-page/plan.md`

## What & Why

The only way to review a card today is the FSRS due-queue on the dashboard — there's no way to review a specific card you pick. This adds a standalone card page at `/memory-cards/[id]` that the listing links to, reusing the dashboard's review UI so you can review any card on demand ("outside the algorithm").

## Starting Point

`ReviewPanel` already renders the full review experience (prompt → reveal → rating buttons) and is not dashboard-coupled. `rateMemoryCard` already works on any card by id regardless of due date. The listing currently routes cards to a note deep-link or the edit page; no card-detail route exists.

## Desired End State

Clicking any card on `/memory-cards` opens a detail page showing the same review UI for that card. You reveal the answer and rate it as a real review (FSRS reschedule + logged `review_event` + counts toward goal), then stay on the card as it refreshes with the new schedule. The per-row Edit button still reaches the edit page.

## Key Decisions Made

| Decision       | Choice                                                | Why (1 sentence)                                                                                         | Source     |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------- |
| Rating effect  | Real review (reuse `rateMemoryCard`)                  | The existing action already handles any card by id — no new mutation needed                              | Brainstorm |
| Post-rate flow | Stay on the card, refresh in place                    | Predictable for an on-demand single-card review                                                          | Brainstorm |
| Review UI      | Reuse `ReviewPanel` as-is                             | Not dashboard-coupled; already owns the celebration provider                                             | Plan       |
| Card shape     | New `getMemoryCardForReview(id)` returning `DueCardT` | Existing `getMemoryCard` embeds `notes(id,title)`, not the `notes(title,subject_id)` `ReviewPanel` needs | Plan       |
| Refresh        | `rateMemoryCard` also `revalidatePath` the card route | One additive line so the page reflects the new schedule                                                  | Plan       |
| Back nav       | Standard `PageShell` `backHref` (as edit page)        | No bespoke control; consistent with sibling detail pages                                                 | Brainstorm |

## Scope

**In scope:** new `/memory-cards/[id]` route, by-id review query, `memoryCardHref` helper, one-line revalidation widening, listing href repoint, E2E spec.

**Out of scope:** practice/no-op mode, any schema/migration/RPC, redirect-after-rating, extra on-page context beyond `ReviewPanel`, dashboard behavior changes.

## Architecture / Approach

New server-component page fans out `getMemoryCardForReview(id)` + `getDailyGoal()` and hands them to the existing `ReviewPanel`. Rating flows through the unchanged `rateMemoryCard` action, now revalidating both `/dashboard` and the card route. The listing's `getHref` repoints to `memoryCardHref(card.id)`.

## Phases at a Glance

| Phase               | What it delivers                                          | Key risk                                                                      |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Card detail page | Working `/memory-cards/[id]` review page + listing link   | `DueCardT` shape mismatch if the new query drifts from `getDueQueue`'s select |
| 2. E2E coverage     | Playwright spec: list → open → reveal → rate → reschedule | Local-stack sign-up flake (mitigated by `retries: 2`)                         |

**Prerequisites:** local Supabase stack for E2E; nothing else.
**Estimated effort:** ~1 session — small surface, mostly reuse.

## Open Risks & Assumptions

- Assumes `ReviewPanel` needs no copy/layout tweak for the card page — confirmed by reading it; the "Memory Card Review" title reads fine on a detail page.
- The test layer (Phase 2) is authored only after the per-slice review gate + `/simplify`, per CLAUDE.md.

## Success Criteria (Summary)

- Any card on the listing opens its review page and can be reviewed on demand.
- Rating reschedules the card and refreshes the page in place.
- The dashboard due-queue and the edit path are unaffected.
