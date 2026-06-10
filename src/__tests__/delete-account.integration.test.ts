import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from './local-supabase-creds'

// Integration gate for R5 (test-plan §2 / Risk Response #5): prove the BYOK OpenRouter credential is
// GONE after account deletion — the FR-006 removal guarantee. The row's teardown rides entirely on
// the `openrouter_credentials.user_id → auth.users on delete cascade` FK, fired by the SECURITY
// DEFINER `delete_account()` RPC. Skipped unless RUN_INTEGRATION=1, so the default `vitest run` stays
// network-free. Run with: pnpm test:integration (requires `supabase start`).
//
// Oracle discipline: the post-delete check reads through a SERVICE-ROLE client (bypasses RLS). A
// read through the deleted user's own session would return zero rows even if the row still existed
// (RLS hides it from a dead session) — that is the R5 anti-pattern ("RLS hides it" ≠ "it is gone").
// Only a service-role read proves the cascade physically removed the row.
const RUN = !!process.env.RUN_INTEGRATION

describe.skipIf(!RUN)('account deletion — OpenRouter credential cascade (integration, R5)', () => {
  let serviceClient: SupabaseClient

  beforeAll(() => {
    serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })

  let seq = 0
  // A fresh signed-up user with an authenticated client (autoconfirm is on locally → immediate session).
  async function createUser(): Promise<{ id: string; client: SupabaseClient }> {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const email = `deluser_${Date.now()}_${seq++}@example.com`
    const { data, error } = await client.auth.signUp({ email, password: 'password123' })
    if (error || !data.user) throw error ?? new Error('signUp returned no user')
    return { id: data.user.id, client }
  }

  it('cascade-removes the credential row and the auth user when the account is deleted', async () => {
    const user = await createUser()

    // Insert a credential row through the user's OWN client (RLS insert-own). Dummy ciphertext —
    // this tests the FK cascade, not decryption; the row only needs to EXIST.
    const { error: insErr } = await user.client.from('openrouter_credentials').insert({
      key_ciphertext: 'ct',
      key_iv: 'iv',
      key_auth_tag: 'tag',
    })
    expect(insErr).toBeNull()

    // Pre-delete: the row physically exists under a service-role read. Establishing this is what makes
    // the post-delete absence meaningful — it can only have come from the cascade.
    const before = await serviceClient
      .from('openrouter_credentials')
      .select('user_id')
      .eq('user_id', user.id)
    expect(before.data).toHaveLength(1)

    // Delete via the SECURITY DEFINER RPC, called as the user — the same path the action takes after
    // its password re-auth (the re-auth + sign-out plumbing is covered by e2e/delete-account.spec.ts).
    const { error: delErr } = await user.client.rpc('delete_account')
    expect(delErr).toBeNull()

    // Confirmed gone via service-role read, not RLS-hidden.
    const after = await serviceClient
      .from('openrouter_credentials')
      .select('user_id')
      .eq('user_id', user.id)
    expect(after.data ?? []).toHaveLength(0)

    // …and the auth user itself — the cascade's root — is gone.
    const { data: lookup } = await serviceClient.auth.admin.getUserById(user.id)
    expect(lookup.user).toBeNull()
  })
})
