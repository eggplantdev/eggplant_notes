import type { Database } from '@/lib/supabase/types'

export type MemoryCardT = Database['public']['Tables']['memory_cards']['Row']

// One card plus its source note (id + title) for the edit page's Unlink affordance. `notes` is null
// for a standalone card (outer join via the memory_cards→notes FK).
export type MemoryCardWithSourceT = MemoryCardT & {
  notes: { id: string; title: string | null } | null
}

// A due-review card plus its source note's title + subject_id, for the card→note link. `title` is
// nullable at the DB level (app enforces it via Zod); `subject_id` is null for unassigned notes
// (drives the subject-scoped vs bare-note link). `notes` is `| null` for a standalone card and
// defensively for a note deleted between the queue read and the render.
export type DueCardT = MemoryCardT & {
  notes: { title: string | null; subject_id: string | null } | null
}

// A card as shown on the /memory-cards listing: slim columns only (never the `example`/
// `code_context` answer text). Subject hangs off the card itself (`memory_cards→subjects` FK), so a
// note-less card still carries a subject; both embeds are `| null` (outer joins).
export type MemoryCardListItemT = Pick<
  MemoryCardT,
  'id' | 'prompt' | 'note_id' | 'due_at' | 'state' | 'subject_id'
> & {
  notes: { title: string | null } | null
  subjects: { title: string } | null
}

// Decoded payload of the card_overview RPC (jsonb) for the whole-deck "Cards overview" chart.
// `byState` maps an FSRS state integer (as a string key, per jsonb) to its count; absent states are
// omitted (the chart zero-fills). `mature` = cards at/over the maturity stability threshold.
export type CardOverviewT = {
  byState: Record<string, number>
  mature: number
  total: number
}
