import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { createSubjectCore } from '@/features/subjects/create-subject-core'
import { updateSubjectCore } from '@/features/subjects/update-subject-core'
import type { Database } from '@/lib/supabase/types'

type Result = { data: unknown; error: unknown }

// Records the from()/insert()/update()/eq() calls and resolves the terminal builder (.single /
// .maybeSingle) to the supplied {data,error}. The supabase query builder is a thenable, so each core
// awaits the chain's tail. The cores take an injectable client, so no module mock is needed.
function fakeClient(result: Result) {
  const calls: { from?: string; insert?: unknown; update?: unknown; eq?: [string, unknown] } = {}
  const chain = {
    insert(data: unknown) {
      calls.insert = data
      return chain
    },
    update(data: unknown) {
      calls.update = data
      return chain
    },
    eq(col: string, val: unknown) {
      calls.eq = [col, val]
      return chain
    },
    select: () => chain,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  }
  const client = {
    from(table: string) {
      calls.from = table
      return chain
    },
  } as unknown as SupabaseClient<Database>
  return { client, calls }
}

describe('createSubjectCore', () => {
  const data = { title: 'Rust', description: 'lang' }

  it('inserts into subjects and returns the new id', async () => {
    const { client, calls } = fakeClient({ data: { id: 's1' }, error: null })
    await expect(createSubjectCore(client, data)).resolves.toEqual({ id: 's1' })
    expect(calls.from).toBe('subjects')
    expect(calls.insert).toEqual(data)
  })

  it('throws the PostgREST error so the caller can shape the result', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    await expect(createSubjectCore(client, data)).rejects.toMatchObject({ message: 'boom' })
  })
})

describe('updateSubjectCore', () => {
  const data = { title: 'Rust 2', description: undefined }

  it('updates the row by id and returns its id', async () => {
    const { client, calls } = fakeClient({ data: { id: 's1' }, error: null })
    await expect(updateSubjectCore(client, 's1', data)).resolves.toEqual({ id: 's1' })
    expect(calls.from).toBe('subjects')
    expect(calls.update).toEqual(data)
    expect(calls.eq).toEqual(['id', 's1'])
  })

  it('resolves undefined when RLS matches no row (not-found, not an error)', async () => {
    const { client } = fakeClient({ data: null, error: null })
    await expect(updateSubjectCore(client, 'missing', data)).resolves.toBeUndefined()
  })

  it('throws on a real PostgREST error', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } })
    await expect(updateSubjectCore(client, 's1', data)).rejects.toMatchObject({ message: 'boom' })
  })
})
