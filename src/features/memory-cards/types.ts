import type { Database } from '@/lib/supabase/types'

export type MemoryCardT = Database['public']['Tables']['memory_cards']['Row']

// A due-review card plus its source note's title + subject_id, for the card→note link (S-08).
// The `notes(title, subject_id)` embed types via the memory_cards→notes FK; `title` is nullable
// at the DB level (the app enforces it via Zod) and `subject_id` is null for unassigned notes
// (drives the subject-scoped vs bare-note link). `notes` is kept `| null` defensively for a note
// deleted between the queue read and the render.
export type DueCardT = MemoryCardT & {
  notes: { title: string | null; subject_id: string | null } | null
}

// A card as shown on the /memory-cards listing: the slim columns the card renders (never the
// `example`/`code_context` answer text or `stability` — the overview chart sources those from
// getCardsForStats) plus the card's OWN subject title (the context chip) and, when linked, its
// source-note title. Post standalone-memory-cards the subject hangs off the card itself
// (`memory_cards→subjects` FK), not the note — so a note-less card still carries a subject;
// `note_id`/`notes` are nullable for standalone cards. Both embeds stay `| null` (outer joins).
export type MemoryCardListItemT = Pick<
  MemoryCardT,
  'id' | 'prompt' | 'note_id' | 'due_at' | 'state' | 'subject_id'
> & {
  notes: { title: string | null } | null
  subjects: { title: string } | null
}
