import type { NoteT } from '@/types/note'

// A note list row plus its subject's title (the "topic" chip). `subjects` is `| null` because a
// note can be unassigned (subject_id null) or its subject detached (on delete set null).
export type NoteListItemT = Pick<NoteT, 'id' | 'title' | 'created_at'> & {
  subjects: { title: string } | null
}
