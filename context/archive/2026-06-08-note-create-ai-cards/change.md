---
change_id: note-create-ai-cards
title: Inline AI card generation on the create-note form
status: archived
created: 2026-06-08
updated: 2026-06-08
archived_at: 2026-06-08T19:51:20Z
---

> Review gate (2026-06-08): automated legs green; review + /simplify clean. Manual + E2E deferred to a
> batched pass per user direction.

## Notes

Dogfooding gap: the create-note form's inline `MemoryCardsField` only has a manual "Add card" button —
no AI. AI card generation exists on the note detail page (grounded on a **saved** note via
`generateCards({ noteId })`) and the standalone card form (ungrounded topic, ≤200 chars). Neither fits
mid-creation: the note isn't saved (no id) and its body exceeds the topic cap.

Scope: let the user generate cards from the note they're **currently writing**, inline, before saving.

1. **`generateCards` gains a `draftNote` source variant** — `{ title, content }` from the in-progress
   form, ungrounded (no DB fetch), material built via the existing `cardsMaterialFromNote`. Mirrors the
   grounded path's material assembly without needing a saved row. Content capped at 50k like notes.
2. **`MemoryCardsField` gets a "Generate cards with AI" button** (next to "Add card") wrapping the
   shared `GenerateDialog`, grounded on the form's reactive title+content. Generated cards are pushed
   into the `checks` array (mapped `{prompt, example}` → `{prompt, example, code_context: ''}`), so they
   ride the existing atomic create-note-with-checks save — nothing new server-side beyond the variant.

Out of scope: changing how cards persist (the existing `createNoteWithChecks` RPC already saves staged
checks atomically). No grounding on a saved note (that's the existing detail-page flow).
