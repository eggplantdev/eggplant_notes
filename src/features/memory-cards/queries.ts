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

// The single soonest-due card plus the total due count, in one round-trip. RLS scopes rows to the
// owner. The `(user_id, due_at)` btree index backs the `due_at <= now()` filter + ordering.
// `count: 'exact'` returns the full match count alongside the `limit(1)` row, so the page renders
// one card without over-fetching the backlog. Hand-rolled (not runTableQuery) because we need both
// the row and the count off the same response.
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

// Every owned card, only the columns the aggregation needs. Returns the full set so counts/buckets
// are computed in TS — PostgREST can't group by the APP_TIME_ZONE-shifted due date in a plain
// select, and a lean fetch-all is sub-ms at personal scale. RLS scopes rows to the owner.
export async function getCardsForStats(client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('memory_cards').select('id, prompt, note_id, due_at, state, stability, lapses'),
  )
}

// Backs the /memory-cards listing, ordered soonest-due first. Selects only the columns the card
// renders (never the `example`/`code_context` answer text). Subject is the card's OWN `subject_id`
// (embedded + filtered via the memory_cards→subjects FK), so a note-less card filters correctly;
// `notes(title)` is an outer join (a standalone card has no note). RLS scopes rows to the owner.
export async function getMemoryCardsList(
  opts?: { subjectIds?: string[]; q?: string; page?: number; limit?: number },
  client?: SupabaseClient<Database>,
): Promise<{ rows: MemoryCardListItemT[]; total: number }> {
  const supabase = client ?? (await createClient())
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? DEFAULT_LIMIT
  const offset = (page - 1) * limit
  const orFilter = opts?.q ? searchOr(['prompt', 'example', 'code_context'], opts.q) : null

  // `head` toggles the rows-vs-count-only variant the 416 fallback reuses.
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

// Single card by id with its source note (id + title) embedded for the Unlink row. Missing OR
// not-owned both resolve to `undefined` via `maybeSingle` (caller decides 404). The note embed is
// an outer join, so a standalone card returns `notes: null`.
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

// Single card by id in the exact DueCardT shape ReviewPanel consumes, so the standalone card page
// reuses the review component verbatim. Embeds `notes(title, subject_id)` — subject_id is what
// SourceNoteLink needs. Missing or not-owned → undefined (caller 404s).
export async function getMemoryCardForReview(
  id: string,
  client?: SupabaseClient<Database>,
): Promise<DueCardT | undefined> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase
    .from('memory_cards')
    .select('*, notes(title, subject_id)')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getMemoryCardForReview] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return data ?? undefined
}

// All memory cards attached to one note, oldest first. RLS scopes rows to the owner, so a note the
// caller doesn't own yields []. Injectable client so Playwright can pass a signInWithPassword
// client for the isolation test.
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
