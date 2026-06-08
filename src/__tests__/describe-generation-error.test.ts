import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'

import { describeGenerationError } from '@/features/openrouter/utils/describe-generation-error'

// Guards the failure-classification contract: each error class maps to a distinct, actionable
// message so a generation failure never collapses to one generic string.

const apiError = (statusCode: number) =>
  new APICallError({
    message: 'x',
    url: 'https://openrouter.ai',
    requestBodyValues: {},
    statusCode,
  })

describe('describeGenerationError', () => {
  it('maps a timeout abort to the timeout message', () => {
    expect(describeGenerationError({ name: 'TimeoutError' })).toMatch(/timed out/i)
    expect(describeGenerationError({ name: 'AbortError' })).toMatch(/timed out/i)
  })

  it('maps 401/403 to a reconnect message', () => {
    expect(describeGenerationError(apiError(401))).toMatch(/reconnect/i)
    expect(describeGenerationError(apiError(403))).toMatch(/reconnect/i)
  })

  it('maps 402 to an insufficient-credits message', () => {
    expect(describeGenerationError(apiError(402))).toMatch(/credits/i)
  })

  it('maps 429 to a rate-limit message', () => {
    expect(describeGenerationError(apiError(429))).toMatch(/rate-limited/i)
  })

  it('maps 5xx to a temporary-error message', () => {
    expect(describeGenerationError(apiError(503))).toMatch(/temporary/i)
  })

  it('falls back to the generic message for an unknown error', () => {
    expect(describeGenerationError(new Error('boom'))).toBe('AI generation failed. Try again.')
    expect(describeGenerationError(apiError(418))).toBe('AI generation failed. Try again.')
  })
})
