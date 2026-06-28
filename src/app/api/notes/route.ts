import { NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson, readJsonBody } from '@/features/api-tokens/route-helpers'
import { insertNoteWithCards } from '@/features/notes/insert-note-with-cards'
import { createNoteWithCardsSchema } from '@/features/notes/schemas'
import { validateInput } from '@/lib/validate'

// POST /api/notes — create a note (+ optional cards) for the token's user. Reuses the same write core
// and schema as the create-note form; RLS (under the minted JWT) owns ownership.
export async function POST(request: Request) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) return parsedBody.res

  const parsed = validateInput(createNoteWithCardsSchema, parsedBody.body)
  if (!parsed.success) return errorJson(400, parsed.error)

  try {
    const id = await insertNoteWithCards(auth.supabase, parsed.data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/notes] insert error', error)
    return errorJson(500, 'Failed to create note')
  }
}

// GET /api/notes — list the caller's notes (titles only), optional ?subject=<uuid> filter. RLS-scoped.
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const subject = new URL(request.url).searchParams.get('subject')
  if (subject !== null && !z.guid().safeParse(subject).success) {
    return errorJson(400, 'Invalid subject id')
  }

  const base = auth.supabase.from('notes').select('id,title,subject_id')
  const { data, error } = await (subject !== null ? base.eq('subject_id', subject) : base)
  if (error) {
    console.error('[GET /api/notes] read error', error)
    return errorJson(500, 'Failed to list notes')
  }
  return NextResponse.json({ notes: data })
}
