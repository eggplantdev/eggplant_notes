import { describe, expect, it } from 'vitest'

import { credentialsSchema } from '@/features/auth/schemas'
import { validateInput } from '@/lib/validate'

describe('validateInput + credentialsSchema', () => {
  it('accepts a valid email and password', () => {
    const result = validateInput(credentialsSchema, {
      email: 'user@example.com',
      password: 'secret88',
    })
    expect(result).toEqual({
      success: true,
      data: { email: 'user@example.com', password: 'secret88' },
    })
  })

  it('rejects a malformed email', () => {
    const result = validateInput(credentialsSchema, {
      email: 'not-an-email',
      password: 'secret88',
    })
    expect(result).toEqual({
      success: false,
      error: 'Enter a valid email address',
    })
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = validateInput(credentialsSchema, {
      email: 'user@example.com',
      password: 'short',
    })
    expect(result).toEqual({
      success: false,
      error: 'Password must be at least 8 characters',
    })
  })
})
