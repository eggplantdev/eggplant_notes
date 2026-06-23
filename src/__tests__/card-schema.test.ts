import { describe, expect, it } from 'vitest'

import { cardsArraySchema, cardWithSubjectSchema } from '@/features/memory-cards/schemas'
import { validateInput } from '@/lib/validate'

// The standalone-create + unified-edit payload (standalone-memory-cards): card fields plus the
// card's own optional subject. Mirrors notes-schema.test.ts.
describe('cardWithSubjectSchema', () => {
  it('accepts a prompt with a null subject and coerces blank optionals to null', () => {
    const result = validateInput(cardWithSubjectSchema, {
      prompt: '  What is a closure?  ',
      example: '   ',
      code_context: '',
      subject_id: null,
    })
    expect(result).toEqual({
      success: true,
      data: { prompt: 'What is a closure?', example: null, code_context: null, subject_id: null },
    })
  })

  it('rejects an empty / whitespace-only prompt', () => {
    const result = validateInput(cardWithSubjectSchema, {
      prompt: '   ',
      example: '',
      code_context: '',
      subject_id: null,
    })
    expect(result).toEqual({ success: false, error: 'Question must be at least 10 characters' })
  })

  it('rejects a too-short prompt (< 10 chars)', () => {
    const result = validateInput(cardWithSubjectSchema, {
      prompt: 'short',
      example: '',
      code_context: '',
      subject_id: null,
    })
    expect(result).toEqual({ success: false, error: 'Question must be at least 10 characters' })
  })

  // The z.guid lesson: DB-originated ids are validated SHAPE-only. A deterministic seed id with a
  // version-0 nibble (…-0000-…) is a valid 128-bit uuid Postgres stores fine; z.guid() must accept
  // it (z.uuid() would reject the non-RFC-v4 version). Non-nil so it can't hide behind z.uuid()'s
  // nil special-case.
  it('accepts a non-v4 (seed-shaped) subject_id', () => {
    const result = validateInput(cardWithSubjectSchema, {
      prompt: 'What is a closure?',
      example: '',
      code_context: '',
      subject_id: '5b1ec700-0000-0000-8000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid-shaped subject_id', () => {
    const result = validateInput(cardWithSubjectSchema, {
      prompt: 'What is a closure?',
      example: '',
      code_context: '',
      subject_id: 'not-a-uuid',
    })
    expect(result).toEqual({ success: false, error: 'Invalid subject id' })
  })
})

// Regression: AI gen-cards (createCardsForNote) sends GeneratedCardT = { prompt, example } with NO
// code_context key. The card insert schema requires that key (a present value must be a string;
// null/omitted → 400) — so the SAVE BOUNDARY must supply `code_context: ''`, not the schema relax it.
// These specs lock that contract so a future "simplify the schema" can't silently break the AI save.
describe('cardsArraySchema — code_context key is required', () => {
  it('rejects a card missing its code_context key (the AI candidate shape pre-mapping)', () => {
    const result = validateInput(cardsArraySchema, [
      { prompt: 'What is a closure?', example: 'A function plus its captured scope.' },
    ])
    expect(result.success).toBe(false)
  })

  it('accepts the mapped payload (code_context: "" → null)', () => {
    const result = validateInput(cardsArraySchema, [
      {
        prompt: 'What is a closure?',
        example: 'A function plus its captured scope.',
        code_context: '',
      },
    ])
    expect(result).toEqual({
      success: true,
      data: [
        {
          prompt: 'What is a closure?',
          example: 'A function plus its captured scope.',
          code_context: null,
        },
      ],
    })
  })
})
