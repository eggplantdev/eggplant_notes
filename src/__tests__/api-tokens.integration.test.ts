import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { ANON_KEY, JWT_SECRET, SUPABASE_URL } from './local-supabase-creds'

// Integration gate for expose-cli-note-api: exercises the REAL pipeline (resolve_api_token DEFINER +
// minted JWT + RLS) against the local Supabase stack — the only layer that actually owns the ownership
// guarantee. Skipped unless RUN_INTEGRATION=1, so the default `vitest run` stays network-free.
// Run with: pnpm test:integration  (requires `supabase start`).
//
// Local deterministic creds come from ./local-supabase-creds (minted demo keys, not secrets — see that
// file). App modules read these via process.env, set below before they are dynamically imported.
const RUN = !!process.env.RUN_INTEGRATION

describe.skipIf(!RUN)('api token pipeline (integration)', () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= ANON_KEY
  process.env.SUPABASE_JWT_SECRET ??= JWT_SECRET
  // env.ts (client) AND env.server.ts both eager-parse their whole schema on import, and importing a
  // route handler pulls both in (the token pipeline's mint-user-jwt reads env.server). So every schema
  // var must be set before the dynamic imports below — even though these tests send no email and never
  // decrypt a key.
  process.env.NEXT_PUBLIC_EMAIL_USER ??= 'noreply@example.com'
  process.env.EMAIL_HOST ??= 'localhost'
  process.env.EMAIL_PASS ??= 'x'
  process.env.EMAIL_TO ??= 'noreply@example.com'
  process.env.OPENROUTER_ENC_KEY ??= Buffer.alloc(32).toString('base64')

  let authenticateRequest: typeof import('@/features/api-tokens/authenticate-request').authenticateRequest
  let generateToken: typeof import('@/features/api-tokens/token').generateToken

  beforeAll(async () => {
    ;({ authenticateRequest } = await import('@/features/api-tokens/authenticate-request'))
    ;({ generateToken } = await import('@/features/api-tokens/token'))
  })

  let seq = 0
  // A fresh signed-up user with an authenticated client (autoconfirm is on locally → immediate session).
  async function createUser(): Promise<{ id: string; client: SupabaseClient }> {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const email = `apitok_${Date.now()}_${seq++}@example.com`
    const { data, error } = await client.auth.signUp({ email, password: 'password123' })
    if (error || !data.user) throw error ?? new Error('signUp returned no user')
    return { id: data.user.id, client }
  }

  // Mint a token for a user by inserting its hash through that user's OWN authenticated client (RLS
  // insert-own) — no service-role. Optional expiry/revocation for the negative cases.
  async function mintToken(
    user: { client: SupabaseClient },
    opts: { expiresAt?: string; revokedAt?: string } = {},
  ): Promise<string> {
    const { raw, hash } = generateToken()
    const { error } = await user.client.from('api_tokens').insert({
      token_hash: hash,
      name: 'integration-test',
      expires_at: opts.expiresAt ?? null,
      revoked_at: opts.revokedAt ?? null,
    })
    if (error) throw error
    return raw
  }

  function req(rawToken: string): Request {
    return new Request('http://localhost/api/notes', {
      headers: { authorization: `Bearer ${rawToken}` },
    })
  }

  async function createNoteVia(supabase: SupabaseClient, title: string, extra: object = {}) {
    const { data, error } = await supabase.rpc('create_note_with_cards', {
      p_note: { title, content: '', subject_title: `subj-${title}`, ...extra },
      p_cards: [],
    })
    if (error) throw error
    return data as string
  }

  it('resolves a valid token to its owner and writes+reads a note under RLS', async () => {
    const a = await createUser()
    const token = await mintToken(a)

    const auth = await authenticateRequest(req(token))
    expect('error' in auth).toBe(false)
    if ('error' in auth) return
    expect(auth.userId).toBe(a.id)

    const noteId = await createNoteVia(auth.supabase, 'A-note')
    const { data } = await auth.supabase.from('notes').select('id,title').eq('id', noteId).single()
    expect(data?.title).toBe('A-note')
  })

  it("isolates tenants: user A cannot read user B's rows", async () => {
    const a = await createUser()
    const b = await createUser()
    const authA = await authenticateRequest(req(await mintToken(a)))
    const authB = await authenticateRequest(req(await mintToken(b)))
    if ('error' in authA || 'error' in authB) throw new Error('auth failed')

    const bNoteId = await createNoteVia(authB.supabase, 'B-note')
    const { data: aSees } = await authA.supabase.from('notes').select('id').eq('id', bNoteId)
    expect(aSees ?? []).toHaveLength(0)
  })

  it('ignores a spoofed user_id in the request body (row lands under the token owner)', async () => {
    const a = await createUser()
    const b = await createUser()
    const authA = await authenticateRequest(req(await mintToken(a)))
    const authB = await authenticateRequest(req(await mintToken(b)))
    if ('error' in authA || 'error' in authB) throw new Error('auth failed')

    // A creates a note while smuggling B's id into the jsonb — the RPC reads fields explicitly + the
    // DB defaults user_id to auth.uid(), so it must be owned by A, invisible to B.
    const noteId = await createNoteVia(authA.supabase, 'spoof', { user_id: b.id })
    const { data: bSees } = await authB.supabase.from('notes').select('id').eq('id', noteId)
    expect(bSees ?? []).toHaveLength(0)
    const { data: aSees } = await authA.supabase.from('notes').select('id').eq('id', noteId)
    expect(aSees ?? []).toHaveLength(1)
  })

  it('rejects an expired token with 401', async () => {
    const a = await createUser()
    const token = await mintToken(a, { expiresAt: '2000-01-01T00:00:00Z' })
    const auth = await authenticateRequest(req(token))
    expect('error' in auth && auth.error.status).toBe(401)
  })

  it('rejects a revoked token with 401', async () => {
    const a = await createUser()
    const token = await mintToken(a, { revokedAt: '2000-01-01T00:00:00Z' })
    const auth = await authenticateRequest(req(token))
    expect('error' in auth && auth.error.status).toBe(401)
  })

  it('rejects a missing/garbage Authorization header with 401', async () => {
    const noHeader = await authenticateRequest(new Request('http://localhost/api/notes'))
    expect('error' in noHeader && noHeader.error.status).toBe(401)
    const garbage = await authenticateRequest(req('egg_not-a-real-token'))
    expect('error' in garbage && garbage.error.status).toBe(401)
  })
})
