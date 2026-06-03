import type { Database } from '@/lib/supabase/types'

// Row type re-exported from the generated Database schema — single source of truth.
export type TopicCheckT = Database['public']['Tables']['topic_checks']['Row']

// A due-review card plus its source note's title, for the card→note link (S-08). The
// `notes(title)` embed types via the topic_checks→notes FK; `title` is nullable at the DB
// level (the app enforces it via Zod), and `notes` is kept `| null` defensively for a note
// deleted between the queue read and the render.
export type DueCardT = TopicCheckT & { notes: { title: string | null } | null }
