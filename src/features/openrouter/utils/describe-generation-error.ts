import { APICallError, NoObjectGeneratedError } from 'ai'

// Map a thrown generation error to a user-facing, actionable message. Ordered most-specific first;
// every branch returns advice the user can act on, so a failure never collapses to one generic
// string. Pure + unit-testable — the actions just call this in their catch.
//
// Why match abort by `error.name`: `AbortSignal.timeout()` rejects with a `TimeoutError`-named
// DOMException (and a manual abort with `AbortError`), which is NOT an `APICallError`, so it must be
// caught before the SDK-error branches.

const GENERIC = 'AI generation failed. Try again.'

function errorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : undefined
}

// OpenRouter/OpenAI-style error bodies carry the actionable text in `{ error: { message } }`. Surface
// it for failures we have no friendlier mapping for — e.g. a 404 "No endpoints found for <model>" —
// instead of collapsing to the generic string and hiding the one thing the user needs to act on.
function bodyMessage(body: unknown): string | undefined {
  const message = (body as { error?: { message?: unknown } })?.error?.message
  return typeof message === 'string' && message.trim().length > 0 ? message.trim() : undefined
}

function providerErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const { data, responseBody } = error as { data?: unknown; responseBody?: unknown }
  let parsed: unknown
  if (typeof responseBody === 'string') {
    try {
      parsed = JSON.parse(responseBody)
    } catch {
      // non-JSON body — nothing structured to surface
    }
  }
  // `data` (SDK-parsed) wins over the raw `responseBody` when both carry a message.
  return bodyMessage(data) ?? bodyMessage(parsed)
}

export function describeGenerationError(error: unknown): string {
  const name = errorName(error)
  if (name === 'TimeoutError' || name === 'AbortError') {
    return 'The model took too long and the request timed out. Try again or pick a faster model.'
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    return "The model didn't return the expected shape. Try again, or pick a different model."
  }

  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return 'OpenRouter rejected your key. Reconnect OpenRouter in Settings.'
      case 429:
        return 'Rate-limited by OpenRouter. Wait a moment and try again.'
      case 408:
        return 'The request timed out upstream. Try again.'
      default:
        if (error.statusCode !== undefined && error.statusCode >= 500) {
          return 'OpenRouter had a temporary error. Try again in a moment.'
        }
        // Unmapped status (e.g. 404 "No endpoints found for <model>") — show the provider's own
        // message so the user can act on it; only fall back to generic if there's no body message.
        return providerErrorMessage(error) ?? GENERIC
    }
  }

  return providerErrorMessage(error) ?? GENERIC
}
