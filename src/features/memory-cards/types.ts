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

// A card as shown on the /memory-cards listing: the row plus the joined source-note title (the
// card→note link uses the row's own note_id) and subject title (the card's context chip). The
// embed types via the memory_cards→notes→subjects FK chain. Subject filtering keys off
// notes.subject_id in the query, but that column isn't projected here — the card doesn't need it.
// `notes`/`subjects` stay `| null` defensively, mirroring DueCardT, even though the query's
// `notes!inner` join makes notes non-null in practice.
export type MemoryCardListItemT = MemoryCardT & {
  notes: {
    title: string | null
    subjects: { title: string } | null
  } | null
}
