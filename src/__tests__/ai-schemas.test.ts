import { describe, expect, it } from 'vitest'

import { generatedCardsSchema, generatedNotesSchema } from '@/features/openrouter/ai-schemas'

// Guards the structured-output contract: a malformed AI response is rejected before anything reaches
// the preview/insert path.
describe('generatedCardsSchema', () => {
  it('accepts well-formed cards', () => {
    expect(generatedCardsSchema.safeParse({ cards: [{ prompt: 'q', example: 'a' }] }).success).toBe(
      true,
    )
  })

  it('rejects a card missing example', () => {
    expect(generatedCardsSchema.safeParse({ cards: [{ prompt: 'q' }] }).success).toBe(false)
  })

  it('rejects a non-array cards field', () => {
    expect(generatedCardsSchema.safeParse({ cards: 'nope' }).success).toBe(false)
  })
})

describe('generatedNotesSchema', () => {
  it('accepts well-formed notes', () => {
    expect(generatedNotesSchema.safeParse({ notes: [{ title: 't', content: 'c' }] }).success).toBe(
      true,
    )
  })

  it('rejects a note missing content', () => {
    expect(generatedNotesSchema.safeParse({ notes: [{ title: 't' }] }).success).toBe(false)
  })
})
