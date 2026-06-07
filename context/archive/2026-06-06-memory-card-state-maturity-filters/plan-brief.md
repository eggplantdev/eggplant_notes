# Memory-Card State & Maturity Filters — Plan Brief

> Full plan: `context/changes/memory-card-state-maturity-filters/plan.md`

## What & Why

The `/memory-cards` listing can be filtered by subject and free-text search, but not by where a card sits in its learning lifecycle. This adds two server-side, URL-driven, multiselect filters — **FSRS state** (New / Learning / Review / Relearning) and **maturity** (Mature / Young) — so the user can slice their deck by recall stage.

## Starting Point

The filter pipeline already exists: `getMemoryCardsList` composes optional predicates through a `filtered(head)` factory and `runPaginatedQuery` (416 fallback solved). `SubjectFilter` holds all the URL/debounce/two-mode/chips logic over the dumb `MultiSelect` primitive, but is hardcoded to the `subjects` param and used by both the notes and memory-cards pages.

## Desired End State

The memory-cards filter row shows four controls — search, Subjects, State, Maturity. Selecting states/maturity re-queries server-side, composes (AND) with subject + search, resets to page 1, and is shareable/back-forward-safe via the URL. The notes page keeps identical subject-filter behavior through the now-generalized component. The "Cards overview" chart stays whole-deck.

## Key Decisions Made

| Decision             | Choice                                                   | Why (1 sentence)                                                                                   | Source       |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| Both filters         | Multiselect                                              | User wants multi-value selection per filter                                                        | Change notes |
| Maturity definition  | `stability ≥ 21` (`MATURE_STABILITY_DAYS`)               | Matches the existing maturity chart; maturity is a label over FSRS stability, not an FSRS variable | Change notes |
| Young includes New   | Yes (stability 0 → Young)                                | New cards are genuinely not-yet-mature; State filter covers New separately                         | Plan         |
| Generalization scope | Full promotion (subjects + state + maturity, both pages) | 3rd consumer triggers the promotion rule; one source of truth                                      | User         |
| State granularity    | Four raw FSRS states                                     | Consistent with the cards-by-state chart, no mapping layer                                         | User         |
| Data layer           | Plain column predicates, no migration                    | Both filters reduce to `.in('state')` / `.gte/.lt('stability')`                                    | Plan         |

## Scope

**In scope:** generalize `SubjectFilter` → `UrlMultiSelectFilter`; refactor subjects on both pages; `state`/`maturity` query predicates; `?state=`/`?maturity=` param parsing + validation; two new filter controls; E2E spec.

**Out of scope:** migration/RPC/computed column, faceted counts, a New maturity bucket, chart changes, notes-page behavior changes beyond the like-for-like refactor.

## Architecture / Approach

Extract `UrlMultiSelectFilter` (parameterized on URL key + label + options) into `components/ui/`; `SubjectFilter` becomes a thin wrapper. The page parses/validates the new params and renders two more instances of the generic. `getMemoryCardsList` gains `states`/`maturity` predicates inside its existing `filtered(head)` factory, so the ranged read and the 416-fallback count stay identical.

## Phases at a Glance

| Phase                           | What it delivers                                                                | Key risk                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Generalize filter component  | `UrlMultiSelectFilter` + subjects refactored on both pages, behavior-preserving | Notes-page regression (wider blast radius) — verified before any new behavior |
| 2. Add state + maturity filters | Working State + Maturity filters on `/memory-cards`                             | Predicate composition / maturity both-bucket edge case                        |
| 3. E2E coverage                 | Playwright spec: apply filters → assert narrowing + AND                         | Local-stack sign-up flake (mitigated by `retries: 2`)                         |

**Prerequisites:** none beyond the local Supabase stack for E2E.
**Estimated effort:** ~1 session — small surface, mostly reuse + one refactor.

## Open Risks & Assumptions

- Refactoring `SubjectFilter` touches the notes listing; Phase 1 is isolated and verified green before Phase 2 layers on new filters.
- Phase 3 (E2E) is authored only after the per-slice review gate + `/simplify`, per CLAUDE.md.

## Success Criteria (Summary)

- State and maturity filters narrow the memory-cards list server-side and compose with subject + search.
- The notes page subject filter is unchanged after the generalization.
- Deep-linked / back-forward filter state works; clearing restores the full list.
