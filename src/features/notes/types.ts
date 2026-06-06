import type { NoteT } from '@/types/note'

// A note list row (the slim columns the list card renders — never `content`) plus its subject's
// title, for the notes list card + subject filter (the "topic" shown on each card). The
// `subjects(title)` embed types via the notes→subjects FK; `subjects` is `| null` because a note
// can be unassigned (subject_id null) or its subject detached (on delete set null).
export type NoteListItemT = Pick<NoteT, 'id' | 'title' | 'created_at'> & {
  subjects: { title: string } | null
}
