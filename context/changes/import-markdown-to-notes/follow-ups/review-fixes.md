# Review follow-ups — import-markdown-to-notes

Deferred findings from the per-slice review gate (2026-06-07). Out of this slice's scope; tracked
here for a later change.

## F3 — Add an OAuth `state` CSRF parameter to the OpenRouter connect

- **Where:** `src/features/openrouter/actions/connect.ts`, `src/app/api/openrouter/callback/route.ts`
- **What:** The PKCE flow has no `state` param binding the callback to the session that started it.
  `SameSite=Lax` on the verifier cookie + the PKCE verifier already gate the exchange, so practical
  risk is low for a BYOK connect.
- **Why deferred:** OpenRouter's auth endpoint isn't confirmed to echo `state` back; adding an
  unverified param could break the live connect. Confirm against OpenRouter's live OAuth docs first,
  then add a random `state` cookie set alongside the verifier and rejected on mismatch in the callback.

## F5 — Hard-verify note ownership in card-creation actions

- **Where:** `src/features/memory-cards/actions/create-cards-for-note.ts` AND the pre-existing
  `src/features/memory-cards/actions/create-memory-card.ts` (same gap).
- **What:** Both fetch the note's `subject_id` via an RLS-scoped read but don't early-return when the
  note read is `null`, so a caller passing a foreign `noteId` still inserts their own card pointing at
  another user's `note_id` (the card is owned by the caller; the foreign note's content is never
  exposed). Low severity; the card row is RLS-owned by the caller.
- **Why deferred:** Cross-cutting — fix both sites together (the new action mirrors the inherited
  pattern). Add `if (!note) return { success: false, error: 'Note not found.' }` after the note read
  in both.
