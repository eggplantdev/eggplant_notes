# Review follow-ups — standalone-memory-cards

Deferred findings from the slice review gate (2026-06-06). Recorded here rather
than fixed in-slice; revisit post-MVP.

## updateNote subject-change fan-out is non-atomic

- **Source:** `/10x-impl-review` F2.
- **Where:** `src/features/notes/actions/update-note.ts` (note UPDATE → moved-cards UPDATE → unlinked-cards UPDATE, three PostgREST round-trips, no transaction).
- **Risk:** if write 2 or 3 fails after the note's subject is already committed, linked cards are stranded on the OLD subject while still linked — the exact "linked card shares its note's subject" invariant this phase enforces. The action returns `{ success: false }`, but a plain retry won't re-open the dialog (the note's subject already equals the new value, so `subjectChanged` is false), so the cards stay stranded until the user changes the subject again.
- **Decision (MVP):** accept. Matches the project's existing Server-Action-over-PostgREST write model (other multi-step actions are likewise non-atomic); single-user personal scale; hard deadline 2026-06-10. Failure is rare and surfaced.
- **Proper fix (post-deadline):** move the fan-out into a single Postgres RPC (one transaction), RLS-aware for subject ownership — mirror the FSRS `record_review` RPC pattern. Then note-update + card move/unlink can't be left half-applied.
