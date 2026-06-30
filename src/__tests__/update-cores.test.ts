import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { updateMemoryCardCore } from '@/features/memory-cards/update-memory-card-core'
import { updateNoteCore } from '@/features/notes/update-note-core'
import type { Database } from '@/lib/supabase/types'

type Result = { data?: unknown; error?: unknown }
type Call = { from: string; op: string; args: unknown[] }

// These cores issue a SEQUENCE of queries (read current → update → optional card move/unlink), so the
// fake resolves a FIFO queue of results — each terminal (`maybeSingle`) AND each directly-awaited chain
// (the card-table `update().eq().in()` writes use the thenable protocol) pulls the next result. `calls`
// records every from()/op so assertions can inspect the derived patch + the card fan-out.
function fakeClient(results: Result[]) {
  const queue = [...results]
  const calls: Call[] = []
  const next = (): Result => queue.shift() ?? { data: null, error: null }

  function makeChain(table: string) {
    const chain = {
      select: (...args: unknown[]) => record('select', args),
      update: (...args: unknown[]) => record('update', args),
      insert: (...args: unknown[]) => record('insert', args),
      eq: (...args: unknown[]) => record('eq', args),
      in: (...args: unknown[]) => record('in', args),
      maybeSingle: () => Promise.resolve(next()),
      single: () => Promise.resolve(next()),
      // Makes a non-terminal chain awaitable (the card writes await `.in(...)` directly).
      then: (resolve: (v: Result) => unknown) => resolve(next()),
    }
    function record(op: string, args: unknown[]) {
      calls.push({ from: table, op, args })
      return chain
    }
    return chain
  }

  const client = {
    from: (table: string) => makeChain(table),
  } as unknown as SupabaseClient<Database>
  return { client, calls }
}

const noteInput = { title: 'T', content: 'body' }
const updatePatch = (calls: Call[], table: string): Record<string, unknown> =>
  calls.find((c) => c.from === table && c.op === 'update')!.args[0] as Record<string, unknown>

describe('updateNoteCore', () => {
  it('subject unchanged: updates fields without (re)deriving position or touching cards', async () => {
    const { client, calls } = fakeClient([
      { data: { subject_id: 'A' } }, // current subject read
      { data: { id: 'n1' } }, // note update
    ])
    const result = await updateNoteCore(client, 'n1', { ...noteInput, subject_id: 'A' })

    expect(result).toEqual({ id: 'n1', subjectChanged: false })
    expect(updatePatch(calls, 'notes')).not.toHaveProperty('position')
    expect(calls.some((c) => c.from === 'memory_cards')).toBe(false)
  })

  it('subject change: stamps position and applies the move + unlink card fan-out', async () => {
    const { client, calls } = fakeClient([
      { data: { subject_id: 'A' } },
      { data: { id: 'n1' } },
      { error: null }, // card unlink (applied first)
      { error: null }, // card move
    ])
    const result = await updateNoteCore(
      client,
      'n1',
      { ...noteInput, subject_id: 'B' },
      {
        move: ['c1'],
        unlink: ['c2'],
      },
    )

    expect(result).toEqual({ id: 'n1', subjectChanged: true })
    const patch = updatePatch(calls, 'notes')
    expect(patch.subject_id).toBe('B')
    expect(typeof patch.position).toBe('number')
    const cardUpdates = calls.filter((c) => c.from === 'memory_cards' && c.op === 'update')
    expect(cardUpdates).toHaveLength(2)
    expect(cardUpdates[0].args[0]).toEqual({ note_id: null }) // unlink detaches first (keeps old subject)
    expect(cardUpdates[1].args[0]).toEqual({ subject_id: 'B' })
  })

  it('move: "all" moves every linked card by note_id without enumerating ids', async () => {
    const { client, calls } = fakeClient([
      { data: { subject_id: 'A' } },
      { data: { id: 'n1' } },
      { error: null }, // card move-all (awaited .update().eq('note_id') chain)
    ])
    const result = await updateNoteCore(
      client,
      'n1',
      { ...noteInput, subject_id: 'B' },
      { move: 'all', unlink: [] },
    )

    expect(result).toEqual({ id: 'n1', subjectChanged: true })
    const cardUpdates = calls.filter((c) => c.from === 'memory_cards' && c.op === 'update')
    expect(cardUpdates).toHaveLength(1)
    expect(cardUpdates[0].args[0]).toEqual({ subject_id: 'B' })
    // Moved by note_id alone — no `id IN (…)` filter.
    expect(calls.some((c) => c.from === 'memory_cards' && c.op === 'in')).toBe(false)
  })

  it('move to None nulls position', async () => {
    const { client, calls } = fakeClient([{ data: { subject_id: 'A' } }, { data: { id: 'n1' } }])
    await updateNoteCore(client, 'n1', { ...noteInput, subject_id: null })
    expect(updatePatch(calls, 'notes').position).toBeNull()
  })

  it('returns notFound when the update matches no row (RLS-invisible / nonexistent)', async () => {
    const { client } = fakeClient([{ data: null }]) // no subject_id in input → only the update runs
    const result = await updateNoteCore(client, 'missing', noteInput)
    expect(result).toEqual({ error: 'Note not found', notFound: true })
  })
})

describe('updateMemoryCardCore', () => {
  const cardInput = { prompt: 'Q?', example: null, subject_id: 'B' }

  it('self-detects the forced unlink (linked card, subject changed) and reports the previous note', async () => {
    // current row: linked to n1, on subject A; input moves it to B → must unlink.
    const { client, calls } = fakeClient([
      { data: { note_id: 'n1', subject_id: 'A' } },
      { data: { id: 'c1' } },
    ])
    const result = await updateMemoryCardCore(client, 'c1', cardInput)

    expect(result).toEqual({ id: 'c1', previousNoteId: 'n1' })
    expect(updatePatch(calls, 'memory_cards')).toMatchObject({ note_id: null, subject_id: 'B' })
  })

  it('leaves the link intact when the subject is unchanged', async () => {
    // current row: linked to n1, already on subject B; input keeps B → no unlink.
    const { client, calls } = fakeClient([
      { data: { note_id: 'n1', subject_id: 'B' } },
      { data: { id: 'c1' } },
    ])
    const result = await updateMemoryCardCore(client, 'c1', cardInput)

    expect(result).toEqual({ id: 'c1', previousNoteId: 'n1' })
    expect(updatePatch(calls, 'memory_cards')).not.toHaveProperty('note_id')
  })

  it('returns notFound when the update matches no row', async () => {
    const { client } = fakeClient([{ data: null }, { data: null }])
    const result = await updateMemoryCardCore(client, 'missing', cardInput)
    expect(result).toEqual({ error: 'Card not found', notFound: true })
  })
})
