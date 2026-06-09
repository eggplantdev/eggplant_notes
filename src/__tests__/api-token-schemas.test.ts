import { describe, expect, it } from 'vitest'

import {
  TOKEN_NAME_MAX_LENGTH,
  mintTokenSchema,
  patchNoteBodySchema,
} from '@/features/api-tokens/schemas'
import { validateInput } from '@/lib/validate'

// The mint form's field validator and the mint action both run the name through these schemas, so this
// locks the boundary contract. The token itself is random bytes (proven by token.ts); only the
// user-supplied name needs validation.
describe('validateInput + mintTokenSchema', () => {
  it('accepts a trimmed name', () => {
    const result = validateInput(mintTokenSchema, { name: '  my-laptop  ' })
    expect(result).toEqual({ success: true, data: { name: 'my-laptop' } })
  })

  it('rejects an empty name', () => {
    const result = validateInput(mintTokenSchema, { name: '   ' })
    expect(result).toEqual({ success: false, error: 'Name is required' })
  })

  it(`rejects a name longer than ${TOKEN_NAME_MAX_LENGTH} characters`, () => {
    const result = validateInput(mintTokenSchema, { name: 'x'.repeat(TOKEN_NAME_MAX_LENGTH + 1) })
    expect(result).toEqual({
      success: false,
      error: `Name must be ${TOKEN_NAME_MAX_LENGTH} characters or fewer`,
    })
  })

  it(`accepts a name at exactly ${TOKEN_NAME_MAX_LENGTH} characters`, () => {
    const result = validateInput(mintTokenSchema, { name: 'x'.repeat(TOKEN_NAME_MAX_LENGTH) })
    expect(result.success).toBe(true)
  })
})

// PATCH /api/notes/:id body. `card_actions` is optional; when present, its `unlink` array must hold
// uuid-SHAPED ids (z.guid — see the DB-id lesson). A version-0 seed id must pass (z.uuid would reject).
describe('patchNoteBodySchema', () => {
  it('accepts the note fields with no card_actions', () => {
    expect(validateInput(patchNoteBodySchema, { title: 'T', content: '' }).success).toBe(true)
  })

  it('accepts a subject move with an explicit unlink list (incl. a non-RFC version-0 id)', () => {
    const result = validateInput(patchNoteBodySchema, {
      title: 'T',
      content: '',
      subject_id: '11111111-0000-0000-0000-000000000000',
      card_actions: { unlink: ['22222222-0000-0000-0000-000000000000'] },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed card id in card_actions', () => {
    const result = validateInput(patchNoteBodySchema, {
      title: 'T',
      content: '',
      card_actions: { unlink: ['not-a-uuid'] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects card_actions missing the unlink array', () => {
    const result = validateInput(patchNoteBodySchema, {
      title: 'T',
      content: '',
      card_actions: {},
    })
    expect(result.success).toBe(false)
  })
})
