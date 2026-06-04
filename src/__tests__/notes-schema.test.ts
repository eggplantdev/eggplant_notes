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

  it('accepts an optional subject_id (uuid, null, or omitted)', () => {
    const withSubject = validateInput(noteInputSchema, {
      title: 'T',
      content: '',
      subject_id: '00000000-0000-0000-0000-000000000000',
    })
    const unassigned = validateInput(noteInputSchema, { title: 'T', content: '', subject_id: null })
    const omitted = validateInput(noteInputSchema, { title: 'T', content: '' })
    expect(withSubject.success).toBe(true)
    expect(unassigned.success).toBe(true)
    expect(omitted.success).toBe(true)
  })

  it('rejects a non-uuid subject_id', () => {
    const result = validateInput(noteInputSchema, {
      title: 'T',
      content: '',
      subject_id: 'not-a-uuid',
    })
    expect(result).toEqual({ success: false, error: 'Invalid subject id' })
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

  // Regression: id schemas validate SHAPE (z.guid), not RFC-4122 version/variant (z.uuid).
  // Deterministic seed ids like `…-0000-0000-…` are version-0 — Postgres stores them, but
  // z.uuid() rejects them, which silently broke every id-validating mutation. Reverting to
  // z.uuid() must turn this red. (The all-zeros nil uuid above is a z.uuid special-case and
  // would NOT catch the regression — this non-nil version-0 id does.)
  it('accepts a non-v4 (version-0) uuid the DB can legitimately hold', () => {
    const result = validateInput(noteIdSchema, '0a7e0000-0000-0000-0000-000000000001')
    expect(result.success).toBe(true)
  })
})
