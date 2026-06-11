import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { noteAttachCardsSchema } from '@/features/api-tokens/schemas'
import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson, readJsonBody } from '@/features/api-tokens/route-helpers'
import { cardWithSubjectSchema, noteIdSchema } from '@/features/memory-cards/schemas'
import { insertCardsForNote } from '@/features/memory-cards/insert-cards-for-note'
import { insertStandaloneCard } from '@/features/memory-cards/insert-standalone-card'
import { subjectIdSchema } from '@/features/subjects/schemas'
import { validateInput } from '@/lib/validate'

// POST /api/memory-cards — create card(s) for the token's user. The body discriminates: `note_id`
// attaches cards to an existing note; otherwise a standalone card under a subject. RLS owns ownership.
export async function POST(request: Request) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) return parsedBody.res
  const body = parsedBody.body

  // Select the branch by the raw presence of `note_id`, then validate against that one schema. A union
  // would let a note-attach body with a malformed `cards` array fall through to the standalone branch
  // (which strips `note_id`) and silently create a standalone card; this routes such a body to a 400.
  const wantsNoteAttach = typeof body === 'object' && body !== null && 'note_id' in body
  const parsed = wantsNoteAttach
    ? validateInput(noteAttachCardsSchema, body)
    : validateInput(cardWithSubjectSchema, body)
  if (!parsed.success) return errorJson(400, parsed.error)

  try {
    const ids =
      'note_id' in parsed.data
        ? await insertCardsForNote(auth.supabase, parsed.data.note_id, parsed.data.cards)
        : [await insertStandaloneCard(auth.supabase, parsed.data)]
    // Token-API write: reset server caches so the next request renders fresh (marks paths, no live push).
    revalidatePath('/', 'layout')
    return NextResponse.json({ ids }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/memory-cards] insert error', error)
    return errorJson(500, 'Failed to create cards')
  }
}

// GET /api/memory-cards — list the caller's cards, optionally filtered so an agent can dedup/inspect
// before writing. `?note=<uuid>` (filter note_id), `?subject=<uuid>` (filter subject_id), `?unfiled=true`
// (subject_id is null). Malformed uuid → 400. RLS-scoped.
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const searchParams = new URL(request.url).searchParams
  const note = searchParams.get('note')
  const subject = searchParams.get('subject')
  const unfiled = searchParams.get('unfiled') === 'true'

  if (note !== null && !noteIdSchema.safeParse(note).success)
    return errorJson(400, 'Invalid note id')
  if (subject !== null && !subjectIdSchema.safeParse(subject).success) {
    return errorJson(400, 'Invalid subject id')
  }

  let query = auth.supabase
    .from('memory_cards')
    .select('id,prompt,example,code_context,note_id,subject_id')
  if (note !== null) query = query.eq('note_id', note)
  if (subject !== null) query = query.eq('subject_id', subject)
  if (unfiled) query = query.is('subject_id', null)

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/memory-cards] read error', error)
    return errorJson(500, 'Failed to list cards')
  }
  return NextResponse.json({ cards: data })
}
