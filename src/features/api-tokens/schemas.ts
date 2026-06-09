import { z } from 'zod'

import { cardsArraySchema, noteIdSchema } from '@/features/memory-cards/schemas'

// Body for POST /api/memory-cards when attaching cards to an existing note. The route selects this schema
// by the PRESENCE of `note_id` in the raw body (the standalone-card branch is `cardWithSubjectSchema`);
// it deliberately does NOT use a z.union, whose fall-through would silently re-route a note-attach body
// with a malformed `cards` array to the standalone branch instead of returning 400.
export const noteAttachCardsSchema = z.object({
  note_id: noteIdSchema,
  cards: cardsArraySchema,
})
