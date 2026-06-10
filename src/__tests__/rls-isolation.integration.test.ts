import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from './local-supabase-creds'

// R1 (test-plan §2 / Risk Response #1): the dedicated two-user, per-table RLS sweep the plan flagged
// as still-pending. For EVERY owner-scoped table, a second authenticated user must be denied both READ
// and WRITE on the first user's row. `api_tokens` has its own IDOR spec (api-tokens.integration.test.ts);
// this covers the other seven. Skipped unless RUN_INTEGRATION=1, so the default `vitest run` stays
// network-free. Run with: pnpm test:integration (requires `supabase start`).
//
// Oracle discipline (§6.2 + Risk Response #1 "Must challenge"):
//  - READ-denial is the contrast "owner sees 1, intruder sees 0". Asserting the owner CAN read the row
//    is what makes the intruder's 0 a genuine denial and not a vacuous pass — a wrong filter fails the
//    owner check instead of silently passing the denial. ("Owner-can-read-own" ≠ "non-owner is denied"
//    — so we assert BOTH, in the same case.)
//  - WRITE-denial (UPDATE/DELETE) is proven by a SERVICE-ROLE read (bypasses RLS). A denied write
//    affects zero rows SILENTLY (no error), so only a service-role read proves the row is unchanged /
//    still present. A read through the intruder's own session would pass even if the write had landed.
const RUN = !!process.env.RUN_INTEGRATION

type SeededRow = { filter: Record<string, unknown>; mutation: Record<string, string | number> }

describe.skipIf(!RUN)('cross-user RLS isolation — per-table sweep (integration, R1)', () => {
  let service: SupabaseClient
  let owner: { id: string; client: SupabaseClient }
  let intruder: { id: string; client: SupabaseClient }

  let seq = 0
  async function createUser(): Promise<{ id: string; client: SupabaseClient }> {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const email = `rls_${Date.now()}_${seq++}@example.com`
    const { data, error } = await client.auth.signUp({ email, password: 'password123' })
    if (error || !data.user) throw error ?? new Error('signUp returned no user')
    return { id: data.user.id, client }
  }

  // Insert a row through the OWNER's own RLS client (insert-own) and return it. Throws on error, so a
  // returned row is a row that physically exists — the precondition the denial assertions rely on.
  async function ownerInsert(table: string, row: object): Promise<Record<string, unknown>> {
    const { data, error } = await owner.client.from(table).insert(row).select().single()
    if (error) throw error
    return data as Record<string, unknown>
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    owner = await createUser()
    intruder = await createUser()
  })

  // One entry per owner-scoped RLS table. `seed` plants the owner's row (+ any FK prerequisites) and
  // returns how to identify it and a single field the intruder will try to overwrite.
  const tables: { name: string; seed: () => Promise<SeededRow> }[] = [
    {
      name: 'subjects',
      seed: async () => {
        const row = await ownerInsert('subjects', { title: 'owner-subj' })
        return { filter: { id: row.id }, mutation: { title: 'HACKED' } }
      },
    },
    {
      name: 'notes',
      seed: async () => {
        const row = await ownerInsert('notes', { title: 'owner-note' })
        return { filter: { id: row.id }, mutation: { title: 'HACKED' } }
      },
    },
    {
      name: 'memory_cards',
      seed: async () => {
        const note = await ownerInsert('notes', { title: 'card-parent' })
        const row = await ownerInsert('memory_cards', { note_id: note.id, prompt: 'owner-prompt' })
        return { filter: { id: row.id }, mutation: { prompt: 'HACKED' } }
      },
    },
    {
      name: 'review_events',
      seed: async () => {
        const note = await ownerInsert('notes', { title: 'event-parent' })
        const card = await ownerInsert('memory_cards', { note_id: note.id, prompt: 'event-card' })
        const row = await ownerInsert('review_events', { memory_card_id: card.id, rating: 3 })
        return { filter: { id: row.id }, mutation: { rating: 5 } }
      },
    },
    {
      name: 'user_prompts',
      seed: async () => {
        await ownerInsert('user_prompts', { prompt_key: 'cards', system: 'owner-sys' })
        return {
          filter: { user_id: owner.id, prompt_key: 'cards' },
          mutation: { system: 'HACKED' },
        }
      },
    },
    {
      name: 'openrouter_credentials',
      seed: async () => {
        await ownerInsert('openrouter_credentials', {
          key_ciphertext: 'ct',
          key_iv: 'iv',
          key_auth_tag: 'tag',
        })
        return { filter: { user_id: owner.id }, mutation: { key_ciphertext: 'HACKED' } }
      },
    },
    {
      name: 'user_settings',
      // Auto-created at signup by a trigger — no insert; the existing row is the target.
      seed: async () => ({ filter: { user_id: owner.id }, mutation: { daily_goal: 999 } }),
    },
  ]

  it.each(tables)(
    'isolates $name: owner reads it; intruder is denied read, update, and delete',
    async ({ name, seed }) => {
      const { filter, mutation } = await seed()
      const [col, value] = Object.entries(mutation)[0]

      // READ: owner can read its own row (proves the row exists + the filter is right); intruder cannot.
      const ownerRead = await owner.client.from(name).select('*').match(filter)
      expect(ownerRead.data ?? []).toHaveLength(1)
      const intruderRead = await intruder.client.from(name).select('*').match(filter)
      expect(intruderRead.data ?? []).toHaveLength(0)

      // UPDATE: the intruder's write affects zero rows silently; the service-role oracle proves the
      // field is unchanged (RLS hid the row from the UPDATE, it did not just hide the result).
      await intruder.client.from(name).update(mutation).match(filter)
      const afterUpdate = await service.from(name).select('*').match(filter).single()
      expect(afterUpdate.data?.[col]).not.toBe(value)

      // DELETE: same — zero-row effect; the service-role oracle proves the row survives.
      await intruder.client.from(name).delete().match(filter)
      const afterDelete = await service.from(name).select('*').match(filter)
      expect(afterDelete.data ?? []).toHaveLength(1)
    },
  )
})
