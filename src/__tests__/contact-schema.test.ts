import { describe, expect, it } from 'vitest'

import { contactSchema } from '@/features/contact/schemas'
import { validateInput } from '@/lib/validate'

// The send action and the dialog's field validators both run input through contactSchema, so this
// locks the boundary contract (the only pure-logic surface of the slice — the SMTP send is I/O and
// the env layer is proven by the build-fail criteria).
describe('validateInput + contactSchema', () => {
  it('accepts a subject and message at the lower bound', () => {
    const result = validateInput(contactSchema, { subject: 'Hi', message: 'Hello there' })
    expect(result).toEqual({
      success: true,
      data: { subject: 'Hi', message: 'Hello there' },
    })
  })

  it('rejects an empty subject', () => {
    const result = validateInput(contactSchema, { subject: '', message: 'body' })
    expect(result).toEqual({ success: false, error: 'Subject is required' })
  })

  it('rejects an empty message', () => {
    const result = validateInput(contactSchema, { subject: 'Hi', message: '' })
    expect(result).toEqual({ success: false, error: 'Message is required' })
  })

  it('rejects a subject longer than 120 characters', () => {
    const result = validateInput(contactSchema, { subject: 'x'.repeat(121), message: 'body' })
    expect(result).toEqual({
      success: false,
      error: 'Subject must be 120 characters or fewer',
    })
  })

  it('accepts a subject at exactly 120 characters', () => {
    const result = validateInput(contactSchema, { subject: 'x'.repeat(120), message: 'body' })
    expect(result.success).toBe(true)
  })

  it('rejects a message longer than 2000 characters', () => {
    const result = validateInput(contactSchema, { subject: 'Hi', message: 'x'.repeat(2001) })
    expect(result).toEqual({
      success: false,
      error: 'Message must be 2000 characters or fewer',
    })
  })

  it('accepts a message at exactly 2000 characters', () => {
    const result = validateInput(contactSchema, { subject: 'Hi', message: 'x'.repeat(2000) })
    expect(result.success).toBe(true)
  })

  it('rejects a subject with a newline (email header injection)', () => {
    const result = validateInput(contactSchema, {
      subject: 'Hi\r\nBcc: attacker@evil.com',
      message: 'body',
    })
    expect(result).toEqual({ success: false, error: 'Subject cannot contain line breaks' })
  })
})
