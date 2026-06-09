import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

// Integration for the token API ROUTES: imports the real route handlers and drives them with minted
// tokens against the local Supabase stack. Skipped unless RUN_INTEGRATION=1. Run: pnpm test:integration
// (requires `supabase start`). Local deterministic creds inlined (the spec process loads no env).
const RUN = !!process.env.RUN_INTEGRATION
const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

describe.skipIf(!RUN)('token API routes (integration)', () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= ANON_KEY
  process.env.SUPABASE_JWT_SECRET ??= JWT_SECRET

  let notesPOST: typeof import('@/app/api/notes/route').POST
  let notesGET: typeof import('@/app/api/notes/route').GET
  let cardsPOST: typeof import('@/app/api/memory-cards/route').POST
  let subjectsGET: typeof import('@/app/api/subjects/route').GET
  let generateToken: typeof import('@/features/api-tokens/token').generateToken

  beforeAll(async () => {
    ;({ POST: notesPOST, GET: notesGET } = await import('@/app/api/notes/route'))
    ;({ POST: cardsPOST } = await import('@/app/api/memory-cards/route'))
    ;({ GET: subjectsGET } = await import('@/app/api/subjects/route'))
    ;({ generateToken } = await import('@/features/api-tokens/token'))
  })

  let seq = 0
  async function userWithToken(): Promise<{ id: string; token: string }> {
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const email = `apiroute_${Date.now()}_${seq++}@example.com`
    const { data, error } = await client.auth.signUp({ email, password: 'password123' })
    if (error || !data.user) throw error ?? new Error('signUp returned no user')
    const { raw, hash } = generateToken()
    const { error: insErr } = await client
      .from('api_tokens')
      .insert({ token_hash: hash, name: 'route-test' })
    if (insErr) throw insErr
    return { id: data.user.id, token: raw }
  }

  function postReq(token: string, path: string, body: unknown): Request {
    return new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  function getReq(token: string | null, path: string): Request {
    return new Request(`http://localhost${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  }

  it('POST /api/notes creates a note (201) and GET /api/notes lists it', async () => {
    const u = await userWithToken()
    const res = await notesPOST(
      postReq(u.token, '/api/notes', {
        note: { title: 'Route note', content: '', subject_title: `route-${Date.now()}` },
        checks: [],
      }),
    )
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    expect(id).toBeTruthy()

    const listRes = await notesGET(getReq(u.token, '/api/notes'))
    expect(listRes.status).toBe(200)
    const { notes } = (await listRes.json()) as { notes: { id: string }[] }
    expect(notes.some((n) => n.id === id)).toBe(true)
  })

  it('POST /api/memory-cards attaches cards to a note (201)', async () => {
    const u = await userWithToken()
    const noteRes = await notesPOST(
      postReq(u.token, '/api/notes', { note: { title: 'N', content: '' }, checks: [] }),
    )
    const { id: noteId } = (await noteRes.json()) as { id: string }

    const res = await cardsPOST(
      postReq(u.token, '/api/memory-cards', {
        note_id: noteId,
        cards: [{ prompt: 'Q?', example: '', code_context: '' }],
      }),
    )
    expect(res.status).toBe(201)
    const { ids } = (await res.json()) as { ids: string[] }
    expect(ids).toHaveLength(1)
  })

  it('POST /api/memory-cards creates a standalone card (201)', async () => {
    const u = await userWithToken()
    const res = await cardsPOST(
      postReq(u.token, '/api/memory-cards', {
        prompt: 'Standalone?',
        example: '',
        code_context: '',
        subject_id: null,
      }),
    )
    expect(res.status).toBe(201)
    const { ids } = (await res.json()) as { ids: string[] }
    expect(ids).toHaveLength(1)
  })

  it("GET /api/subjects returns only the caller's subjects", async () => {
    const a = await userWithToken()
    const b = await userWithToken()
    const marker = `A-only-${Date.now()}`
    await notesPOST(
      postReq(a.token, '/api/notes', {
        note: { title: 'AX', content: '', subject_title: marker },
        checks: [],
      }),
    )
    const { subjects: aSubs } = (await (
      await subjectsGET(getReq(a.token, '/api/subjects'))
    ).json()) as {
      subjects: { title: string }[]
    }
    const { subjects: bSubs } = (await (
      await subjectsGET(getReq(b.token, '/api/subjects'))
    ).json()) as {
      subjects: { title: string }[]
    }
    expect(aSubs.some((s) => s.title === marker)).toBe(true)
    expect(bSubs.some((s) => s.title === marker)).toBe(false)
  })

  it('401 on missing token; 400 on malformed JSON and invalid body shape', async () => {
    expect((await notesGET(getReq(null, '/api/notes'))).status).toBe(401)

    const u = await userWithToken()
    const malformed = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
      body: '{ not json',
    })
    expect((await notesPOST(malformed)).status).toBe(400)
    expect((await notesPOST(postReq(u.token, '/api/notes', { note: {}, checks: [] }))).status).toBe(
      400,
    )
  })
})
