import { describe, expect, it } from 'vitest'

import { noteIdSchema, noteInputSchema } from '@/features/notes/schemas'
import { validateInput } from '@/lib/validate'

describe('validateInput + noteInputSchema', () => {
  it('accepts a title and body, trimming the title', () => {
    const result = validateInput(noteInputSchema, {
      title: '  My note  ',
      content: '# hello',
    })
    expect(result).toEqual({
      success: true,
      data: { title: 'My note', content: '# hello' },
    })
  })

  it('accepts an empty body (title-only note)', () => {
    const result = validateInput(noteInputSchema, { title: 'T', content: '' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty / whitespace-only title', () => {
    const result = validateInput(noteInputSchema, { title: '   ', content: '' })
    expect(result).toEqual({ success: false, error: 'Title is required' })
  })

  it('rejects a title longer than 200 characters', () => {
    const result = validateInput(noteInputSchema, {
      title: 'x'.repeat(201),
      content: '',
    })
    expect(result).toEqual({
      success: false,
      error: 'Title must be 200 characters or fewer',
    })
  })
})

describe('validateInput + noteIdSchema', () => {
  it('accepts a uuid', () => {
    const result = validateInput(noteIdSchema, '00000000-0000-0000-0000-000000000000')
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid id', () => {
    const result = validateInput(noteIdSchema, 'not-a-uuid')
    expect(result).toEqual({ success: false, error: 'Invalid note id' })
  })
})
