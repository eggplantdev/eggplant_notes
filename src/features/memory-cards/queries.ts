import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  DueCardT,
  MemoryCardListItemT,
  MemoryCardT,
  MemoryCardWithSourceT,
} from '@/features/memory-cards/types'
import { runPaginatedQuery } from '@/lib/supabase/run-paginated-query'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { searchOr } from '@/lib/supabase/search-filter'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { DEFAULT_LIMIT } from '@/lib/utils/pagination'

// The due-review queue for the dashboard review panel: the single soonest-due card plus the total due count, in
// one round-trip. RLS scopes rows to the owner. The `(user_id, due_at)` btree index backs the
// `due_at <= now()` filter + ordering. `count: 'exact'` returns the full match count alongside
// the `limit(1)` row, so the page renders one card without over-fetching the whole backlog.
// As of S-03 the review write path sets a future `due_at` via FSRS; a freshly-created card
// defaults `due_at` to now() so it is due immediately until its first review reschedules it.
// Does NOT use runTableQuery: that wrapper returns rows and throws on null data, whereas here
// we need both the row and the count off the same response — so it's hand-rolled. Embeds
// notes(title) (typed via the memory_cards→notes FK) so the card can link to its source note
// by title (S-08) without a second round-trip.
export async function getDueQueue(
  client?: SupabaseClient<Database>,
): Promise<{ first?: DueCardT; count: number }> {
  const supabase = client ?? (await createClient())
  const now = new Date().toISOString()
  const { data, count, error } = await supabase
    .from('memory_cards')
    .select('*, notes(title, subject_id)', { count: 'exact' })
    .lte('due_at', now)
    .order('due_at', { ascending: true })
    .limit(1)
  if (error) {
    console.error('[getDueQueue] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return { first: data?.[0], count: count ?? 0 }
}

// Lean read backing the dashboard stats AND the /memory-cards "cards overview" charts: every
// owned card, but only the columns the aggregation needs. RLS scopes rows to the owner. Returns
// the full set so counts/buckets are computed in TS — PostgREST can't group by the
// APP_TIME_ZONE-shifted due date in a plain select (same constraint as getReviewActivity), and a
// lean fetch-all is sub-ms at personal scale. `state` is here for the cards-overview FSRS
// state-mix chart (it reads the entire deck, decoupled from the paginated list). Personal-scale
// data, so fetching all rows is fine. Injectable client per the isolation rule.
export async function getCardsForStats(client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('memory_cards').select('id, prompt, note_id, due_at, state, stability, lapses'),
  )
}

// Backs the /memory-cards listing: each owned card with its source-note title + subject, selecting
// only the columns the card renders (never the `example`/`code_context` answer text), optionally
// narrowed to selected subjects and/or a `?q=` search across the prompt+answer columns, ordered
// soonest-due first so the list doubles as a study-readiness view. RLS scopes rows to the owner.
// Subject is the card's OWN `subject_id` now (standalone-memory-cards): `subjects(title)` embeds via
// the memory_cards→subjects FK and the filter keys off `memory_cards.subject_id`, so a note-less
// card filters correctly. `notes(title)` is therefore a plain OUTER join (a standalone card has no
// note). Paginated: returns the page's rows + the full match `total` off one `count: 'exact'`
// response (the getDueQueue precedent — hand-rolled, not via runTableQuery). Injectable client.
export async function getMemoryCardsList(
  opts?: { subjectIds?: string[]; q?: string; page?: number; limit?: number },
  client?: SupabaseClient<Database>,
): Promise<{ rows: MemoryCardListItemT[]; total: number }> {
  const supabase = client ?? (await createClient())
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? DEFAULT_LIMIT
  const offset = (page - 1) * limit
  const orFilter = opts?.q ? searchOr(['prompt', 'example', 'code_context'], opts.q) : null

  // Build the filtered query; `head` toggles the rows-vs-count-only variant the 416 fallback reuses.
  const filtered = (head: boolean) => {
    let query = supabase
      .from('memory_cards')
      .select('id, prompt, note_id, due_at, state, subject_id, notes(title), subjects(title)', {
        count: 'exact',
        head,
      })
    if (opts?.subjectIds && opts.subjectIds.length > 0) {
      query = query.in('subject_id', opts.subjectIds)
    }
    if (orFilter) query = query.or(orFilter)
    return query
  }

  return runPaginatedQuery(
    'getMemoryCardsList',
    filtered(false)
      .order('due_at', { ascending: true })
      .range(offset, offset + limit - 1),
    () => filtered(true),
  )
}

// Single card by id for the unified edit page (standalone-memory-cards), with its source note
// (id + title) embedded for the Unlink row. Missing OR not-owned both resolve to `undefined`
// (caller decides 404), via `maybeSingle` — same contract as getSubject/getNote. The note embed
// is an outer join, so a standalone card returns `notes: null`. Injectable client per the rule.
export async function getMemoryCard(
  id: string,
  client?: SupabaseClient<Database>,
): Promise<MemoryCardWithSourceT | undefined> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase
    .from('memory_cards')
    .select('*, notes(id, title)')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getMemoryCard] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return data ?? undefined
}

// Returns all memory cards attached to one note, oldest first (FR-015). RLS scopes rows to the
// owner, so a note the caller doesn't own yields []. Injectable client (defaults to the server
// client) so Playwright can call it with a signInWithPassword client per the isolation test.
export async function getMemoryCardsForNote(
  noteId: string,
  client?: SupabaseClient<Database>,
): Promise<MemoryCardT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c
      .from('memory_cards')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true }),
  )
}
