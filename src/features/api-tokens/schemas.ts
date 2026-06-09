import { z } from 'zod'

import {
  cardWithSubjectSchema,
  memoryCardInputSchema,
  noteIdSchema,
} from '@/features/memory-cards/schemas'

// Body for POST /api/memory-cards. Discriminated by shape: `{ note_id, cards }` attaches cards to an
// existing note; otherwise it's a standalone card (`cardWithSubjectSchema`: prompt/example/code_context
// + nullable subject_id). The route branches on the presence of `note_id`. `cards` is capped to bound
// the bulk insert (mirrors createCardsForNote).
export const apiMemoryCardBodySchema = z.union([
  z.object({
    note_id: noteIdSchema,
    cards: z.array(memoryCardInputSchema).min(1).max(20),
  }),
  cardWithSubjectSchema,
])

export type ApiMemoryCardBodyT = z.infer<typeof apiMemoryCardBodySchema>
