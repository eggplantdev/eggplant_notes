import { describe, expect, it } from 'vitest'

import { validateInput } from '@/features/auth/validate'
import { credentialsSchema } from '@/features/auth/schema'

describe('validateInput + credentialsSchema', () => {
  it('accepts a valid email and password', () => {
    const result = validateInput(credentialsSchema, {
      email: 'user@example.com',
      password: 'secret6',
    })
    expect(result).toEqual({
      success: true,
      data: { email: 'user@example.com', password: 'secret6' },
    })
  })

  it('rejects a malformed email', () => {
    const result = validateInput(credentialsSchema, {
      email: 'not-an-email',
      password: 'secret6',
    })
    expect(result).toEqual({
      success: false,
      error: 'Enter a valid email address',
    })
  })

  it('rejects a password shorter than 6 characters', () => {
    const result = validateInput(credentialsSchema, {
      email: 'user@example.com',
      password: 'short',
    })
    expect(result).toEqual({
      success: false,
      error: 'Password must be at least 6 characters',
    })
  })
})
