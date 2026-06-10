import { PostgrestError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { runTableAction } from '@/lib/supabase/run-table-action'

// Hardening fix (2) / R5 error-leak surface (test-plan §2): a failed PostgREST write must return a
// GENERIC client message — DB internals (constraint/column/table names, error codes) must never
// reach the client — while the real error is still logged server-side for debugging. `createClient`
// is stubbed (the real one is server-only + cookie-bound); the PostgREST `call` is supplied directly,
// so this exercises the real normalize-and-mask logic without a live DB.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }))

const schema = z.object({ name: z.string() })
const GENERIC_ERROR = 'Something went wrong. Please try again.'

// A realistic PostgREST unique-violation — the kind of payload that leaks schema names if echoed.
// A real PostgrestError instance (postgrest-js 2.106 made the response a discriminated union whose
// failure branch types `error` as the PostgrestError class, which a plain literal can't satisfy).
const leakyError = new PostgrestError({
  message: 'duplicate key value violates unique constraint "notes_user_id_title_key"',
  details: 'Key (user_id, title)=(abc, Foo) already exists.',
  hint: '',
  code: '23505',
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('runTableAction — error masking (R5 leak surface)', () => {
  it('returns the generic message on a PostgREST error, never the DB internals', async () => {
    const result = await runTableAction(schema, { name: 'Foo' }, async () => ({
      success: false,
      data: null,
      error: leakyError,
      count: null,
      status: 409,
      statusText: 'Conflict',
    }))

    expect(result).toEqual({ success: false, error: GENERIC_ERROR })
    // The masking guarantee: no constraint/column/table name and no error code reach the caller.
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('constraint')
    expect(serialized).not.toContain('notes_user_id_title_key')
    expect(serialized).not.toContain('23505')
  })

  it('still logs the real PostgREST error server-side (mask the client, not the logs)', async () => {
    await runTableAction(schema, { name: 'Foo' }, async () => ({
      success: false,
      data: null,
      error: leakyError,
      count: null,
      status: 409,
      statusText: 'Conflict',
    }))

    expect(console.error).toHaveBeenCalledWith('[runTableAction] PostgREST error', leakyError)
  })

  it('returns the affected row on success', async () => {
    const row = { id: '1', name: 'Foo' }
    const result = await runTableAction(schema, { name: 'Foo' }, async () => ({
      success: true,
      data: row,
      error: null,
      count: 1,
      status: 200,
      statusText: 'OK',
    }))

    expect(result).toEqual({ success: true, data: row })
  })

  it('returns the validation error (not the generic mask) when input is invalid', async () => {
    const call = vi.fn()
    const result = await runTableAction(schema, { name: 123 }, call)

    expect(result.success).toBe(false)
    // A bad-input message must survive for inline form display — only DB errors get masked, and the
    // write must not run at all.
    if (!result.success) expect(result.error).not.toBe(GENERIC_ERROR)
    expect(call).not.toHaveBeenCalled()
  })
})
