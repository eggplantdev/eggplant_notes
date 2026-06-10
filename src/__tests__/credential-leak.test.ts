import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'

import { describeGenerationError } from '@/features/openrouter/utils/describe-generation-error'

// R5 (test-plan §2 / Risk Response #5): the BYOK OpenRouter key must never appear in error responses
// or the client bundle. This file guards the two reachable leak surfaces:
//
//   1. ERROR RESPONSES — `describeGenerationError` is what the generation actions return to the client
//      on failure. A thrown `APICallError` carries the request (url, body values, headers, cause) and
//      the SDK's raw message — any of which could embed the key. We assert the user-facing message
//      never echoes a sentinel key planted in those fields.
//   2. CLIENT BUNDLE — the plaintext key never reaches the browser because the modules that read it
//      are `import 'server-only'` (build-time error if imported client-side). We pin that directive so
//      its removal — the actual regression that would let the key into the bundle — fails a test.
//
// What this does NOT do: a full production-bundle grep (build `.next`, scan static chunks for the
// secret). That belongs in CI (§5 "credential-leak scan | CI"), which is not wired yet; the
// source-pin below is the cheap proxy until it is.

const SENTINEL = 'sk-or-v1-SENTINELLEAKKEY0000000000000000000000000000'

describe('describeGenerationError — never echoes the API key (R5 error-leak)', () => {
  // The dangerous request-side fields, all seeded with the sentinel. None of these is a field the
  // describer is allowed to surface (it returns curated strings or only the provider body message).
  const leaky = {
    message: `boom auth=Bearer ${SENTINEL}`,
    url: `https://openrouter.ai/api?key=${SENTINEL}`,
    requestBodyValues: { authorization: `Bearer ${SENTINEL}` },
    responseHeaders: { authorization: `Bearer ${SENTINEL}` },
    cause: new Error(`upstream rejected Bearer ${SENTINEL}`),
  }

  it('masks the key on a curated branch (5xx → temporary-error message)', () => {
    const error = new APICallError({ ...leaky, statusCode: 503 })
    const out = describeGenerationError(error)

    expect(out).toMatch(/temporary/i)
    expect(out).not.toContain(SENTINEL)
  })

  it('masks the key on the 401/403 reconnect branch', () => {
    const out = describeGenerationError(new APICallError({ ...leaky, statusCode: 401 }))

    expect(out).toMatch(/reconnect/i)
    expect(out).not.toContain(SENTINEL)
  })

  it('surfaces the provider body message but still never the key (unmapped 404)', () => {
    // The provider's own error text is shown for unmapped statuses — but it must come from
    // `data.error.message`, not from any request field carrying the key.
    const error = new APICallError({
      ...leaky,
      statusCode: 404,
      data: { error: { message: 'No endpoints found for some/model.' } },
    })
    const out = describeGenerationError(error)

    expect(out).toBe('No endpoints found for some/model.')
    expect(out).not.toContain(SENTINEL)
  })

  it('falls back to generic for a plain Error and never echoes its message', () => {
    const out = describeGenerationError(new Error(`crashed with Bearer ${SENTINEL}`))

    expect(out).toBe('AI generation failed. Try again.')
    expect(out).not.toContain(SENTINEL)
  })
})

describe('server-only boundary — plaintext key cannot enter the client bundle (R5)', () => {
  // Removing `import 'server-only'` from a key-handling module is the regression that would let the
  // bundler inline the secret into client JS. Pin the directive so that removal fails here.
  const serverOnlyModules = [
    'src/features/openrouter/credential.ts', // reads + decrypts the plaintext key
    'src/lib/env.server.ts', // holds the server-only env (incl. encryption material)
  ]

  it.each(serverOnlyModules)(
    "%s starts the server-only boundary with `import 'server-only'`",
    (rel) => {
      const source = readFileSync(resolve(process.cwd(), rel), 'utf8')
      expect(source).toContain("import 'server-only'")
    },
  )

  it('aes-gcm relies on node:crypto as its browser barrier (no NEXT_PUBLIC_ enc key)', () => {
    // aes-gcm has no `server-only` directive by design — `node:crypto` is unbundleable for the
    // browser, and the master key is read from a non-public env var (never inlined client-side).
    const source = readFileSync(resolve(process.cwd(), 'src/lib/crypto/aes-gcm.ts'), 'utf8')
    expect(source).toContain("from 'node:crypto'")
    expect(source).not.toContain('NEXT_PUBLIC_')
  })
})
