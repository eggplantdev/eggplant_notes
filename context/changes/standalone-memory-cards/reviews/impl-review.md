# Implementation Review — standalone-memory-cards

> `/10x-impl-review`, run as part of the slice review gate, 2026-06-06. All 4 phases. Verdict: **APPROVED** (0 critical, 2 warnings, 3 observations). Captured verbatim from the review agent.

```
═══════════════════════════════════════════════════════════
  IMPLEMENTATION REVIEW: Standalone Memory Cards
  Scope: All 4 phases (complete)  |  Date: 2026-06-06
  Findings: 0 critical  2 warnings  3 observations
═══════════════════════════════════════════════════════════

  Plan Adherence        PASS
  Scope Discipline      PASS
  Safety & Quality      PASS
  Architecture          PASS
  Pattern Consistency   PASS
  Success Criteria      WARNING   (1 finding — build blocked by unrelated WIP)

  ► Overall: APPROVED
```

## Warnings

**F1 — Working-tree build red, but only from unrelated styling WIP.** `dashboard/page.tsx` (uncommitted) referenced glow experiments not part of this change; the committed standalone-memory-cards state was green at commit time (Progress 3.3/4.3). typegen + typecheck + lint all pass. Resolved during the gate (user committed/finished the WIP; build green). No action on this change.

**F2 — `updateNote` subject-change fan-out is non-atomic** (`src/features/notes/actions/update-note.ts`). Three sequential writes (note UPDATE → moved-cards UPDATE → unlinked-cards UPDATE), no transaction. A mid-fan-out failure can strand linked cards on the old subject while still linked (violates the invariant), with no auto re-prompt. **Decision:** accept for MVP (matches the project's existing Server-Action-over-PostgREST write model; single-user, personal scale, hard deadline). Proper fix = single RLS-aware RPC, post-deadline. → recorded in `follow-ups/review-fixes.md`.

## Observations

**F3 — `createMemoryCard` insert spread order** — `{ note_id, subject_id, ...data }` was safe but fragile if the schema gains `subject_id`. **Fixed** in the gate (`/simplify`): reordered to `{ ...data, note_id, subject_id }`.

**F4 — `createStandaloneCard` relies on Zod's default key-strip** — safe (matches `createNote`); no change.

**F5 — Mid-build invariant revision** ("a linked card always shares its note's subject"; per-card move/unlink + card-side unlink-on-subject-change) is a documented, deliberate scope evolution beyond the first-draft Phase-4 wording — plan + brief + code agree. Not drift.

## Verified PASS evidence

- Migration RLS mirrors the notes reference exactly (insert + update subject-ownership check); `note_id` nullable, `subject_id` FK `on delete set null` + index; no triggers.
- Action signature changes propagated to every caller (`deleteMemoryCard(id, noteId?)`, `updateMemoryCard(id, input, unlinkFromNote?)`, new `createStandaloneCard`/`unlinkCardFromNote`).
- Null-note read paths all guarded — no `/notes/undefined` path possible.
- Seed: single idempotent post-hoc subject_id backfill covering both accounts.

```

```
