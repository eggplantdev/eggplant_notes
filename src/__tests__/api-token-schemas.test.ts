import { describe, expect, it } from 'vitest'

import { TOKEN_NAME_MAX_LENGTH, mintTokenSchema } from '@/features/api-tokens/schemas'
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
