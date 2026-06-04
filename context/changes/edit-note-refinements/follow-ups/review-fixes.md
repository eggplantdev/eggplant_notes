# Review follow-ups — edit-note-refinements

Findings from the slice-review gate (2026-06-04) that are **real but out of this slice's scope**. Recorded per project convention; address in a future change, not here.

## Deferred

### Promote `topic-checks` `schemas`/`types` to a shared tier (pre-existing)

- **Source:** `feature-first-structure` review (inter-module).
- **Finding:** `src/features/topic-checks/schemas.ts` and `types.ts` are imported by **two other features** — `features/notes` (`note-form.tsx`, `schemas.ts` use `promptSchema`/`topicCheckInputSchema`) and `features/review` (`rate-topic-check.ts`, `scheduling.ts` use the schema + `TopicCheckT`). By the promotion rule (lift to a shared tier on the **2nd** consumer), these now qualify for promotion out of `features/topic-checks/` into `src/types/` (types) and a shared schema location.
- **Why deferred:** **Pre-existing** — none of those import sites are in this slice's diff (base `a35572a`). S-17 introduced no new cross-feature import. Fixing it here would be scope creep and touch files unrelated to the slice.
- **Suggested home:** a dedicated `/10x-new` change (e.g. `promote-topic-check-contracts`).

### Centralize card-Link nav-neutralization in `AnimatedCardList.renderAction`

- **Source:** `/simplify` altitude + reuse agents.
- **Finding:** the "interactive control inside a card `<Link>`" problem is solved twice — `NoteCardActions` neutralizes nav on a wrapper `<div onClick={blockNav}>`, and `SubjectCardNewNoteButton` does `preventDefault`/`stopPropagation` inline per-button. `AnimatedCardList` owns the constraint (its `renderAction` JSDoc even documents the footgun) but pushes it onto every consumer. Deeper form: give the `renderAction` wrapper (`animated-card-list.tsx:57`) the `onClick={(e) => { preventDefault(); stopPropagation() }}` once; both consumers then drop their bespoke handling, and new consumers get it for free. Centralizing on the parent wrapper (bubble phase) is also _safer_ than per-button — it can't hit the Radix-trigger-child `preventDefault` trap.
- **Why deferred:** modifies the **shared `AnimatedCardList` primitive** (this slice's plan explicitly excludes touching it) and `features/subjects/.../subject-card-new-note-button.tsx`, which a **parallel session (S-15) is actively editing** — touching it now risks a cross-branch collision. The current per-consumer approach is correct and works; this is an enhancement, not a fix.

### Per-card eager Radix `AlertDialog` mount on the notes list (perf, if lists grow)

- **Source:** `/simplify` efficiency agent.
- **Finding:** `NoteCardActions` mounts a full `DeleteNoteButton` (Radix `AlertDialog` tree + `useActionTransition`) for **every** card, eagerly, even unopened. On a long list that's N dialog instances on first paint. Bounded + acceptable for the current MVP-sized, solo list; revisit if the notes list grows large. Fix options: lazy-mount `AlertDialogContent` behind open-state, or a single shared dialog driven by a "pending-delete id".
- **Why deferred:** refactors the **shared `DeleteNoteButton`** (also used on the detail page) — out of this slice's scope; behavior-adjacent.

## Resolved during the gate (no follow-up needed)

- **F1** (plan's Radix-trigger fix was a latent bug) — reconciled in `plan.md` Phase 3 #1 as-built note; code shipped the correct wrapper approach.
- **F3** (`.next-prodtest` ignore) — verified already gitignored (line 19) + eslint-ignored; no action.
- **F4/F5** (onCancel/Hide beyond plan; form comment) — plan noted; comment already accurate.
- Tailwind v4 audit, module-cohesion audit — clean.
