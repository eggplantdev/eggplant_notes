import { describe, expect, it } from 'vitest'

import { noteAttachCardsSchema } from '@/features/api-tokens/schemas'
import { cardWithSubjectSchema } from '@/features/memory-cards/schemas'

// The POST /api/memory-cards body has two shapes. The route selects which schema to validate against by
// the raw presence of `note_id` (see route + schemas comments) — it does NOT lean on a z.union, whose
// fall-through silently re-routed a malformed note-attach body to the standalone branch (F1). These specs
// lock each branch's rules; the route-level selection is proven in api-routes.integration.test.ts.
const GUID = '00000000-0000-0000-0000-000000000001'
const validCard = { prompt: 'Q?', example: '', code_context: '' }

describe('memory-cards API body schemas', () => {
  describe('noteAttachCardsSchema', () => {
    it('accepts a note_id with 1 card', () => {
      expect(noteAttachCardsSchema.safeParse({ note_id: GUID, cards: [validCard] }).success).toBe(
        true,
      )
    })

    it('rejects an empty cards array (min 1)', () => {
      expect(noteAttachCardsSchema.safeParse({ note_id: GUID, cards: [] }).success).toBe(false)
    })

    it('rejects more than 20 cards (cap)', () => {
      const cards = Array.from({ length: 21 }, () => validCard)
      expect(noteAttachCardsSchema.safeParse({ note_id: GUID, cards }).success).toBe(false)
    })

    it('rejects a non-array cards — the F1 misroute input must fail, not fall through', () => {
      expect(noteAttachCardsSchema.safeParse({ note_id: GUID, cards: 'garbage' }).success).toBe(
        false,
      )
    })

    it('rejects an invalid note_id shape', () => {
      expect(noteAttachCardsSchema.safeParse({ note_id: 'nope', cards: [validCard] }).success).toBe(
        false,
      )
    })

    it('rejects a card missing its prompt', () => {
      expect(
        noteAttachCardsSchema.safeParse({
          note_id: GUID,
          cards: [{ example: '', code_context: '' }],
        }).success,
      ).toBe(false)
    })
  })

  describe('cardWithSubjectSchema (standalone branch)', () => {
    it('accepts a standalone card with a nullable subject_id', () => {
      expect(cardWithSubjectSchema.safeParse({ ...validCard, subject_id: null }).success).toBe(true)
    })

    it('rejects a body with no prompt', () => {
      expect(cardWithSubjectSchema.safeParse({ subject_id: null }).success).toBe(false)
    })
  })
})
