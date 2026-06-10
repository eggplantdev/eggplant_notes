import { describe, expect, it } from 'vitest'

import { getFieldErrorText } from '@/components/forms/utils'

describe('getFieldErrorText', () => {
  it('joins distinct messages with a comma', () => {
    expect(getFieldErrorText(['Title is required', 'Too long'])).toBe('Title is required, Too long')
  })

  it('normalizes standard-schema issue objects to their message', () => {
    expect(getFieldErrorText([{ message: 'Enter a valid email address' }])).toBe(
      'Enter a valid email address',
    )
  })

  // Regression for U-4: a field wiring the same schema to both onBlur and onSubmit yields one
  // identical issue per validator; the rendered text must not read "X, X".
  it('dedupes identical messages from onBlur + onSubmit validators', () => {
    const dup = { message: 'Enter a valid email address' }
    expect(getFieldErrorText([dup, dup])).toBe('Enter a valid email address')
  })

  it('dedupes identical string and issue-object messages alike', () => {
    expect(getFieldErrorText(['Title is required', { message: 'Title is required' }])).toBe(
      'Title is required',
    )
  })

  it('drops null/undefined/unrecognized entries', () => {
    expect(getFieldErrorText([undefined, null, 42, 'Real error'])).toBe('Real error')
  })
})
