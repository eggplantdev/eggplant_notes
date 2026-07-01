import type { PostgrestFilterBuilder, SupabaseClient } from '@supabase/supabase-js'

import { MATURE_STABILITY_DAYS, type MaturityT } from '@/features/memory-cards/constants'
import type {
  CardOverviewT,
  DueCardT,
  MemoryCardListItemT,
  MemoryCardT,
  MemoryCardWithSourceT,
} from '@/features/memory-cards/types'
import { cardOverviewSchema } from '@/features/memory-cards/schemas'
import { runMaybeSingle } from '@/lib/supabase/run-maybe-single'
import { runPaginatedQuery } from '@/lib/supabase/run-paginated-query'
import { runRpc } from '@/lib/supabase/run-rpc'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { searchOr } from '@/lib/supabase/search-filter'
import { createClient } from '@/lib/supabase/create-server-client'
import type { Database } from '@/lib/supabase/types'
import { pageRange } from '@/lib/utils/pagination'

// The subject/state/maturity/search predicate shared by the listing and the due query, so both
// honor the same filters off one source. Takes an already-`.select()`ed builder and chains the
// where-clauses on; PostgREST filters are projection-independent, so it works on either query's
// columns. Generic over the concrete builder type T (the `any`s are only the constraint bound) so
// the caller keeps its projection→row typing. Column names aren't checked inside (Row is `any`
// here); the call sites' result types are. Maturity is derived from `stability`, not a column of
// its own — both buckets (or neither) selected = no constraint; exactly one bucket narrows.
type CardFilterOptsT = {
  subjectIds?: string[]
  q?: string
  states?: number[]
  maturity?: MaturityT[]
}

// `any` in the bound is deliberate: it sidesteps the builder's per-position generic variance so any
// concrete memory_cards builder satisfies it, while `T` itself stays inferred (call-site projection
// typing is preserved). A precise bound would need postgrest-js's unexported `GenericSchema`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCardFilters<T extends PostgrestFilterBuilder<any, any, any, any>>(
  query: T,
  opts?: CardFilterOptsT,
): T {
  if (opts?.subjectIds && opts.subjectIds.length > 0) {
    query = query.in('subject_id', opts.subjectIds)
  }
  if (opts?.states && opts.states.length > 0) query = query.in('state', opts.states)
  if (opts?.maturity?.length === 1) {
    query =
      opts.maturity[0] === 'mature'
        ? query.gte('stability', MATURE_STABILITY_DAYS)
        : query.lt('stability', MATURE_STABILITY_DAYS)
  }
  const orFilter = opts?.q ? searchOr(['prompt', 'example'], opts.q) : null
  if (orFilter) query = query.or(orFilter)
  return query
}

// The single soonest-due card plus the total due count, in one round-trip. RLS scopes rows to the
// owner. The `(user_id, due_at)` btree index backs the `due_at <= now()` filter + ordering.
// `count: 'exact'` returns the full match count alongside the `limit(1)` row, so the page renders
// one card without over-fetching the backlog. Hand-rolled (not runTableQuery) because we need both
// the row and the count off the same response. `opts` scopes the queue to the same filters as the
// listing (the /memory-cards review panel); the dashboard calls it with no opts (global queue).
export async function getDueQueue(
  opts?: CardFilterOptsT & {
    // Skip a card by id — used right after rating it so an "Again" reschedule (still due now) can't
    // re-surface the same card as the next in queue.
    excludeId?: string
  },
  client?: SupabaseClient<Database>,
): Promise<{ first?: DueCardT; count: number }> {
  const supabase = client ?? (await createClient())
  const now = new Date().toISOString()
  let query = applyCardFilters(
    supabase.from('memory_cards').select('*, notes(title, subject_id)', { count: 'exact' }),
    opts,
  )
    .lte('due_at', now)
    .order('due_at', { ascending: true })
    .limit(1)
  if (opts?.excludeId) query = query.neq('id', opts.excludeId)
  const { data, count, error } = await query
  if (error) {
    console.error('[getDueQueue] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return { first: data?.[0], count: count ?? 0 }
}

// Soonest card by due_at WITHOUT the due gate — the "review ahead" fallback for /memory-cards when
// nothing is due yet: the user asked to keep reviewing instead of hitting a caught-up dead end. Same
// filters as the listing so it stays topic-scoped; page-independent (no pagination), so it's the
// soonest match overall, not the soonest on the current page. `limit(1)` → one card or undefined.
export async function getSoonestReviewCard(
  opts?: CardFilterOptsT,
  client?: SupabaseClient<Database>,
): Promise<DueCardT | undefined> {
  const supabase = client ?? (await createClient())
  const { data, error } = await applyCardFilters(
    supabase.from('memory_cards').select('*, notes(title, subject_id)'),
    opts,
  )
    .order('due_at', { ascending: true })
    .limit(1)
  if (error) {
    console.error('[getSoonestReviewCard] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return data?.[0]
}

// Whole-deck counts for the "Cards overview" chart (per FSRS state + mature split), aggregated in
// the card_overview RPC instead of fetching every card and bucketing in TS. SECURITY INVOKER, so
// RLS scopes the counts to the owner. Returns a jsonb whose shape the RPC guarantees (safe cast).
export async function getCardOverview(client?: SupabaseClient<Database>): Promise<CardOverviewT> {
  const supabase = client ?? (await createClient())
  const data = await runRpc('getCardOverview', () =>
    supabase.rpc('card_overview', { p_mature_stability: MATURE_STABILITY_DAYS }),
  )
  return cardOverviewSchema.parse(data)
}

// Backs the /memory-cards listing, ordered newest-created first (the review panel — getDueQueue —
// owns due-order; this is the browse view). Selects only the columns the card renders (never the
// `example` answer text); `created_at` is projected solely to drive the ordering. Subject is the
// card's OWN `subject_id`
// (embedded + filtered via the memory_cards→subjects FK), so a note-less card filters correctly;
// `notes(title)` is an outer join (a standalone card has no note). RLS scopes rows to the owner.
export async function getMemoryCardsList(
  opts?: CardFilterOptsT & { page?: number; limit?: number },
  client?: SupabaseClient<Database>,
): Promise<{ rows: MemoryCardListItemT[]; total: number }> {
  const supabase = client ?? (await createClient())
  const { offset, limit } = pageRange(opts)

  // `head` toggles the rows-vs-count-only variant the 416 fallback reuses. `stability` stays out of
  // the projection — applyCardFilters only needs it for the maturity WHERE clause.
  const filtered = (head: boolean) =>
    applyCardFilters(
      supabase
        .from('memory_cards')
        .select(
          'id, prompt, note_id, due_at, state, subject_id, created_at, notes(title), subjects(title)',
          {
            count: 'exact',
            head,
          },
        ),
      opts,
    )

  return runPaginatedQuery(
    'getMemoryCardsList',
    filtered(false)
      .order('created_at', { ascending: false })
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
  return runMaybeSingle(
    'getMemoryCard',
    supabase.from('memory_cards').select('*, notes(id, title)').eq('id', id).maybeSingle(),
  )
}

// Single card by id in the exact DueCardT shape ReviewPanel consumes, so the standalone card page
// reuses the review component verbatim. Embeds `notes(title, subject_id)` — subject_id is what
// SourceNoteLink needs. Missing or not-owned → undefined (caller 404s).
export async function getMemoryCardForReview(
  id: string,
  client?: SupabaseClient<Database>,
): Promise<DueCardT | undefined> {
  const supabase = client ?? (await createClient())
  return runMaybeSingle(
    'getMemoryCardForReview',
    supabase.from('memory_cards').select('*, notes(title, subject_id)').eq('id', id).maybeSingle(),
  )
}

// All memory cards attached to one note, newest first. RLS scopes rows to the owner, so a note the
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
      .order('created_at', { ascending: false }),
  )
}
