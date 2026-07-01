import { describe, expect, it, vi } from 'vitest'

// queries.ts is server-only and builds a cookie-bound client — stub both so the error/empty/data
// branches are testable in isolation. The fake client returns whatever {data,error} the test supplies
// at the end of the .from().select().is().order() chain (supabase query builders are thenable).
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/create-server-client', () => ({ createClient: vi.fn() }))

import { getApiTokens } from '@/features/api-tokens/queries'
import { createClient } from '@/lib/supabase/create-server-client'

type QueryResult = { data: unknown; error: unknown }

function mockClientReturning(result: QueryResult) {
  const chain = {
    select: () => chain,
    is: () => chain,
    order: () => Promise.resolve(result),
  }
  vi.mocked(createClient).mockResolvedValue({
    from: () => chain,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('getApiTokens', () => {
  it('returns { ok: true, tokens } on a successful read', async () => {
    const rows = [{ id: '1', name: 'cli', created_at: 't', last_used_at: null }]
    mockClientReturning({ data: rows, error: null })
    expect(await getApiTokens()).toEqual({ ok: true, tokens: rows })
  })

  it('returns { ok: true, tokens: [] } when the user genuinely has none', async () => {
    mockClientReturning({ data: [], error: null })
    expect(await getApiTokens()).toEqual({ ok: true, tokens: [] })
  })

  it('returns { ok: false } on a read error — NOT an empty array', async () => {
    mockClientReturning({ data: null, error: { message: 'boom' } })
    expect(await getApiTokens()).toEqual({ ok: false })
  })
})
