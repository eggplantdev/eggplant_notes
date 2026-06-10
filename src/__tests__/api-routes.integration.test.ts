import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { ANON_KEY, JWT_SECRET, SUPABASE_URL } from './local-supabase-creds'

// Integration for the token API ROUTES: imports the real route handlers and drives them with minted
// tokens against the local Supabase stack. Skipped unless RUN_INTEGRATION=1. Run: pnpm test:integration
// (requires `supabase start`). Local deterministic creds come from ./local-supabase-creds (not secrets).
const RUN = !!process.env.RUN_INTEGRATION

describe.skipIf(!RUN)('token API routes (integration)', () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= ANON_KEY
  process.env.SUPABASE_JWT_SECRET ??= JWT_SECRET
  // The client env (env.ts) eager-parses every NEXT_PUBLIC_* on import — incl. the contact-form sender
  // — so importing any route handler needs this set even though these tests send no email.
  process.env.NEXT_PUBLIC_EMAIL_USER ??= 'noreply@example.com'

  let notesPOST: typeof import('@/app/api/notes/route').POST
  let notesGET: typeof import('@/app/api/notes/route').GET
  let noteIdGET: typeof import('@/app/api/notes/[id]/route').GET
  let noteIdPATCH: typeof import('@/app/api/notes/[id]/route').PATCH
  let noteIdDELETE: typeof import('@/app/api/notes/[id]/route').DELETE
  let cardsPOST: typeof import('@/app/api/memory-cards/route').POST
  let cardsGET: typeof import('@/app/api/memory-cards/route').GET
  let cardIdPATCH: typeof import('@/app/api/memory-cards/[id]/route').PATCH
  let cardIdDELETE: typeof import('@/app/api/memory-cards/[id]/route').DELETE
  let subjectsGET: typeof import('@/app/api/subjects/route').GET
  let subjectsPOST: typeof import('@/app/api/subjects/route').POST
  let subjectIdPATCH: typeof import('@/app/api/subjects/[id]/route').PATCH
  let subjectIdDELETE: typeof import('@/app/api/subjects/[id]/route').DELETE
  let generateToken: typeof import('@/features/api-tokens/token').generateToken

  beforeAll(async () => {
    ;({ POST: notesPOST, GET: notesGET } = await import('@/app/api/notes/route'))
    ;({
      GET: noteIdGET,
      PATCH: noteIdPATCH,
      DELETE: noteIdDELETE,
    } = await import('@/app/api/notes/[id]/route'))
    ;({ POST: cardsPOST, GET: cardsGET } = await import('@/app/api/memory-cards/route'))
    ;({ PATCH: cardIdPATCH, DELETE: cardIdDELETE } =
      await import('@/app/api/memory-cards/[id]/route'))
    ;({ GET: subjectsGET, POST: subjectsPOST } = await import('@/app/api/subjects/route'))
    ;({ PATCH: subjectIdPATCH, DELETE: subjectIdDELETE } =
      await import('@/app/api/subjects/[id]/route'))
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
  function patchReq(token: string, path: string, body: unknown): Request {
    return new Request(`http://localhost${path}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  function delReq(token: string | null, path: string): Request {
    return new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  }
  // The dynamic [id] route handlers take Next's RouteContext, whose `params` is a Promise.
  const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

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

  it('POST /api/memory-cards 400s a note-attach body with a malformed cards array (no silent misroute)', async () => {
    const u = await userWithToken()
    const noteRes = await notesPOST(
      postReq(u.token, '/api/notes', { note: { title: 'NM', content: '' }, checks: [] }),
    )
    const { id: noteId } = (await noteRes.json()) as { id: string }

    // note_id present + bad `cards` + otherwise-valid standalone fields: pre-F1 this fell through the
    // z.union to the standalone branch (note_id stripped) and created a 201 card. The fix must 400 it.
    const res = await cardsPOST(
      postReq(u.token, '/api/memory-cards', {
        note_id: noteId,
        cards: 'garbage',
        prompt: 'sneaky standalone',
        example: '',
        code_context: '',
        subject_id: null,
      }),
    )
    expect(res.status).toBe(400)
  })

  it('POST /api/notes stamps the note subject onto its checks-cards (linked → same subject)', async () => {
    const u = await userWithToken()
    const { id: subjectId } = (await (
      await subjectsPOST(postReq(u.token, '/api/subjects', { title: `chk-${Date.now()}` }))
    ).json()) as { id: string }

    const { id: noteId } = (await (
      await notesPOST(
        postReq(u.token, '/api/notes', {
          note: { title: 'WithSubject', content: '', subject_id: subjectId },
          checks: [{ prompt: 'inherits-subject', example: '', code_context: '' }],
        }),
      )
    ).json()) as { id: string }

    const { cards } = (await (
      await cardsGET(getReq(u.token, `/api/memory-cards?note=${noteId}`))
    ).json()) as { cards: { note_id: string | null; subject_id: string | null }[] }

    expect(cards).toHaveLength(1)
    expect(cards[0].note_id).toBe(noteId) // linked to the note
    expect(cards[0].subject_id).toBe(subjectId) // and filed under the note's subject, not unfiled
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

  it('GET /api/notes/:id returns the note content + its cards; foreign id → 404; bad id → 400', async () => {
    const u = await userWithToken()
    const { id } = (await (
      await notesPOST(
        postReq(u.token, '/api/notes', {
          note: { title: 'Readback', content: '# Hello' },
          checks: [{ prompt: 'Q1?', example: '', code_context: '' }],
        }),
      )
    ).json()) as { id: string }

    const res = await noteIdGET(getReq(u.token, `/api/notes/${id}`), idCtx(id))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      note: { content: string }
      cards: { prompt: string }[]
    }
    expect(body.note.content).toBe('# Hello')
    expect(body.cards).toHaveLength(1)
    expect(body.cards[0].prompt).toBe('Q1?')

    // Another user can't read it → 404 (don't leak existence), not 403.
    const other = await userWithToken()
    expect((await noteIdGET(getReq(other.token, `/api/notes/${id}`), idCtx(id))).status).toBe(404)
    expect(
      (await noteIdGET(getReq(u.token, '/api/notes/not-a-uuid'), idCtx('not-a-uuid'))).status,
    ).toBe(400)
  })

  it('POST /api/subjects creates (201), PATCH /api/subjects/:id renames (200), GET lists it', async () => {
    const u = await userWithToken()
    const title = `S-${Date.now()}`
    const createRes = await subjectsPOST(postReq(u.token, '/api/subjects', { title }))
    expect(createRes.status).toBe(201)
    const { id } = (await createRes.json()) as { id: string }

    const newTitle = `${title}-renamed`
    const patchRes = await subjectIdPATCH(
      patchReq(u.token, `/api/subjects/${id}`, { title: newTitle }),
      idCtx(id),
    )
    expect(patchRes.status).toBe(200)

    const { subjects } = (await (await subjectsGET(getReq(u.token, '/api/subjects'))).json()) as {
      subjects: { id: string; title: string }[]
    }
    expect(subjects.find((s) => s.id === id)?.title).toBe(newTitle)

    const other = await userWithToken()
    expect(
      (
        await subjectIdPATCH(
          patchReq(other.token, `/api/subjects/${id}`, { title: 'x' }),
          idCtx(id),
        )
      ).status,
    ).toBe(404)
  })

  it('GET /api/memory-cards filters by note, subject, and unfiled; bad filter → 400', async () => {
    const u = await userWithToken()
    // A card's subject is its OWN column, independent of any note: the create-note RPC inserts
    // note-attached cards with subject_id null (the decouple-cards model — migration 20260606161054),
    // so each filter is tested against cards whose subject_id we set directly.
    const { id: subjectId } = (await (
      await subjectsPOST(postReq(u.token, '/api/subjects', { title: `flt-${Date.now()}` }))
    ).json()) as { id: string }

    await cardsPOST(
      postReq(u.token, '/api/memory-cards', {
        prompt: 'filed-card',
        example: '',
        code_context: '',
        subject_id: subjectId,
      }),
    )
    await cardsPOST(
      postReq(u.token, '/api/memory-cards', {
        prompt: 'unfiled-card',
        example: '',
        code_context: '',
        subject_id: null,
      }),
    )
    const { id: noteId } = (await (
      await notesPOST(
        postReq(u.token, '/api/notes', {
          note: { title: 'F', content: '' },
          checks: [{ prompt: 'note-card', example: '', code_context: '' }],
        }),
      )
    ).json()) as { id: string }

    const byNote = (await (
      await cardsGET(getReq(u.token, `/api/memory-cards?note=${noteId}`))
    ).json()) as { cards: { prompt: string }[] }
    expect(byNote.cards.map((c) => c.prompt)).toEqual(['note-card'])

    const bySubject = (await (
      await cardsGET(getReq(u.token, `/api/memory-cards?subject=${subjectId}`))
    ).json()) as { cards: { prompt: string }[] }
    expect(bySubject.cards.map((c) => c.prompt)).toEqual(['filed-card'])

    // unfiled = subject_id null → the unfiled standalone AND the note-attached card (subject_id null),
    // never the filed one.
    const unfiled = (await (
      await cardsGET(getReq(u.token, '/api/memory-cards?unfiled=true'))
    ).json()) as { cards: { prompt: string }[] }
    const unfiledPrompts = unfiled.cards.map((c) => c.prompt)
    expect(unfiledPrompts).toContain('unfiled-card')
    expect(unfiledPrompts).toContain('note-card')
    expect(unfiledPrompts).not.toContain('filed-card')

    expect((await cardsGET(getReq(u.token, '/api/memory-cards?note=nope'))).status).toBe(400)
    expect((await cardsGET(getReq(u.token, '/api/memory-cards?subject=nope'))).status).toBe(400)
  })

  it('DELETE /api/notes/:id removes the note and cascades its cards', async () => {
    const u = await userWithToken()
    const { id } = (await (
      await notesPOST(
        postReq(u.token, '/api/notes', {
          note: { title: 'ToDelete', content: '' },
          checks: [{ prompt: 'c?', example: '', code_context: '' }],
        }),
      )
    ).json()) as { id: string }

    const before = (await (
      await noteIdGET(getReq(u.token, `/api/notes/${id}`), idCtx(id))
    ).json()) as { cards: unknown[] }
    expect(before.cards).toHaveLength(1)

    const del = await noteIdDELETE(delReq(u.token, `/api/notes/${id}`), idCtx(id))
    expect(del.status).toBe(200)
    expect((await del.json()).id).toBe(id)

    expect((await noteIdGET(getReq(u.token, `/api/notes/${id}`), idCtx(id))).status).toBe(404)
    const cards = (await (
      await cardsGET(getReq(u.token, `/api/memory-cards?note=${id}`))
    ).json()) as { cards: unknown[] }
    expect(cards.cards).toHaveLength(0)
  })

  it('DELETE /api/subjects/:id unfiles its members (subject_id → null), does not delete them', async () => {
    const u = await userWithToken()
    const subjTitle = `unfile-${Date.now()}`
    const { id: noteId } = (await (
      await notesPOST(
        postReq(u.token, '/api/notes', {
          note: { title: 'Filed', content: '', subject_title: subjTitle },
          checks: [{ prompt: 'k?', example: '', code_context: '' }],
        }),
      )
    ).json()) as { id: string }
    const { subjects } = (await (await subjectsGET(getReq(u.token, '/api/subjects'))).json()) as {
      subjects: { id: string; title: string }[]
    }
    const subjectId = subjects.find((s) => s.title === subjTitle)!.id

    expect(
      (await subjectIdDELETE(delReq(u.token, `/api/subjects/${subjectId}`), idCtx(subjectId)))
        .status,
    ).toBe(200)

    const back = (await (
      await noteIdGET(getReq(u.token, `/api/notes/${noteId}`), idCtx(noteId))
    ).json()) as { note: { subject_id: string | null } }
    expect(back.note.subject_id).toBeNull()
  })

  it('DELETE /api/memory-cards/:id removes one card; second delete → 404', async () => {
    const u = await userWithToken()
    const { ids } = (await (
      await cardsPOST(
        postReq(u.token, '/api/memory-cards', {
          prompt: 'standalone',
          example: '',
          code_context: '',
          subject_id: null,
        }),
      )
    ).json()) as { ids: string[] }
    const cardId = ids[0]

    expect(
      (await cardIdDELETE(delReq(u.token, `/api/memory-cards/${cardId}`), idCtx(cardId))).status,
    ).toBe(200)
    // Already gone → 404 (RLS-invisible row is indistinguishable from nonexistent).
    expect(
      (await cardIdDELETE(delReq(u.token, `/api/memory-cards/${cardId}`), idCtx(cardId))).status,
    ).toBe(404)
  })

  it('401 on the new id routes without a token', async () => {
    expect((await noteIdGET(getReq(null, '/api/notes/x'), idCtx('x'))).status).toBe(401)
    expect((await noteIdDELETE(delReq(null, '/api/notes/x'), idCtx('x'))).status).toBe(401)
    expect((await subjectsPOST(getReq(null, '/api/subjects'))).status).toBe(401)
  })

  // Seed a note that owns one attached card, plus a fresh target subject to move into. Returns the
  // note id, the (note-attached) card id, and the target subject id.
  async function seedNoteWithCard(u: { token: string }): Promise<{
    noteId: string
    cardId: string
    sourceSubjectId: string
    targetSubjectId: string
  }> {
    const { id: noteId } = (await (
      await notesPOST(
        postReq(u.token, '/api/notes', {
          note: { title: 'P2', content: 'body', subject_title: `from-${Date.now()}-${seq++}` },
          checks: [{ prompt: 'linked?', example: '', code_context: '' }],
        }),
      )
    ).json()) as { id: string }
    // The checks-card inherits the note's subject (create_note_with_checks stamps it), so a linked card
    // shares its note's subject. Capture that source subject for the unlink/edit assertions below.
    const { note, cards } = (await (
      await noteIdGET(getReq(u.token, `/api/notes/${noteId}`), idCtx(noteId))
    ).json()) as { note: { subject_id: string }; cards: { id: string }[] }
    const { id: targetSubjectId } = (await (
      await subjectsPOST(postReq(u.token, '/api/subjects', { title: `to-${Date.now()}-${seq++}` }))
    ).json()) as { id: string }
    return { noteId, cardId: cards[0].id, sourceSubjectId: note.subject_id, targetSubjectId }
  }

  it('PATCH /api/notes/:id move-all default: a subject change carries the linked cards along', async () => {
    const u = await userWithToken()
    const { noteId, cardId, targetSubjectId } = await seedNoteWithCard(u)

    const res = await noteIdPATCH(
      patchReq(u.token, `/api/notes/${noteId}`, {
        title: 'P2',
        content: 'body',
        subject_id: targetSubjectId,
      }),
      idCtx(noteId),
    )
    expect(res.status).toBe(200)

    const { note, cards } = (await (
      await noteIdGET(getReq(u.token, `/api/notes/${noteId}`), idCtx(noteId))
    ).json()) as {
      note: { subject_id: string | null }
      cards: { id: string; subject_id: string | null; note_id: string | null }[]
    }
    expect(note.subject_id).toBe(targetSubjectId)
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe(cardId)
    expect(cards[0].subject_id).toBe(targetSubjectId)
    expect(cards[0].note_id).toBe(noteId)
  })

  it('PATCH /api/notes/:id with card_actions.unlink detaches the named cards (note_id → null)', async () => {
    const u = await userWithToken()
    const { noteId, cardId, sourceSubjectId, targetSubjectId } = await seedNoteWithCard(u)

    const res = await noteIdPATCH(
      patchReq(u.token, `/api/notes/${noteId}`, {
        title: 'P2',
        content: 'body',
        subject_id: targetSubjectId,
        card_actions: { unlink: [cardId] },
      }),
      idCtx(noteId),
    )
    expect(res.status).toBe(200)

    // The note now owns no cards; the unlinked card survives, KEEPING its own subject (the note's
    // source subject) — unlink drops the note link, it does not unfile the card.
    const { cards } = (await (
      await noteIdGET(getReq(u.token, `/api/notes/${noteId}`), idCtx(noteId))
    ).json()) as { cards: unknown[] }
    expect(cards).toHaveLength(0)
    const bySource = (await (
      await cardsGET(getReq(u.token, `/api/memory-cards?subject=${sourceSubjectId}`))
    ).json()) as { cards: { id: string; note_id: string | null }[] }
    const survivor = bySource.cards.find((c) => c.id === cardId)
    expect(survivor).toBeDefined() // still filed under the source subject
    expect(survivor?.note_id ?? null).toBeNull() // but detached from the note
  })

  it('PATCH /api/memory-cards/:id changing an attached card subject forces an unlink; field-only edit keeps the link', async () => {
    const u = await userWithToken()
    const { noteId, cardId, sourceSubjectId, targetSubjectId } = await seedNoteWithCard(u)

    // Field-only edit (subject unchanged — re-send the card's CURRENT subject) → stays linked.
    const fieldOnly = await cardIdPATCH(
      patchReq(u.token, `/api/memory-cards/${cardId}`, {
        prompt: 'edited prompt',
        example: '',
        code_context: '',
        subject_id: sourceSubjectId,
      }),
      idCtx(cardId),
    )
    expect(fieldOnly.status).toBe(200)
    const stillLinked = (await (
      await noteIdGET(getReq(u.token, `/api/notes/${noteId}`), idCtx(noteId))
    ).json()) as { cards: { id: string; prompt: string }[] }
    expect(stillLinked.cards).toHaveLength(1)
    expect(stillLinked.cards[0].prompt).toBe('edited prompt')

    // Subject change on the (still attached) card → forced unlink (note_id → null), new subject kept.
    const moved = await cardIdPATCH(
      patchReq(u.token, `/api/memory-cards/${cardId}`, {
        prompt: 'edited prompt',
        example: '',
        code_context: '',
        subject_id: targetSubjectId,
      }),
      idCtx(cardId),
    )
    expect(moved.status).toBe(200)
    const afterMove = (await (
      await noteIdGET(getReq(u.token, `/api/notes/${noteId}`), idCtx(noteId))
    ).json()) as { cards: unknown[] }
    expect(afterMove.cards).toHaveLength(0) // unlinked
    const bySubject = (await (
      await cardsGET(getReq(u.token, `/api/memory-cards?subject=${targetSubjectId}`))
    ).json()) as { cards: { id: string }[] }
    expect(bySubject.cards.some((c) => c.id === cardId)).toBe(true)
  })

  it('PATCH id routes: foreign id → 404, malformed body → 400, no token → 401', async () => {
    const u = await userWithToken()
    const { noteId, cardId } = await seedNoteWithCard(u)
    const other = await userWithToken()

    // Foreign caller can't touch either row → 404 (RLS-invisible, don't leak existence).
    expect(
      (
        await noteIdPATCH(
          patchReq(other.token, `/api/notes/${noteId}`, { title: 'x', content: '' }),
          idCtx(noteId),
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await cardIdPATCH(
          patchReq(other.token, `/api/memory-cards/${cardId}`, {
            prompt: 'x',
            example: '',
            code_context: '',
            subject_id: null,
          }),
          idCtx(cardId),
        )
      ).status,
    ).toBe(404)

    expect(
      (await noteIdPATCH(patchReq(u.token, `/api/notes/${noteId}`, { content: '' }), idCtx(noteId)))
        .status,
    ).toBe(400)
    expect((await noteIdPATCH(delReq(null, '/api/notes/x'), idCtx('x'))).status).toBe(401)
    expect((await cardIdPATCH(delReq(null, '/api/memory-cards/x'), idCtx('x'))).status).toBe(401)
  })
})
