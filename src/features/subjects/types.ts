import type { NoteT } from '@/types/note'
import type { SubjectT } from '@/types/subject'

export type SubjectNoteSummaryT = Pick<NoteT, 'id' | 'title' | 'position'>

// Subject shape for picker `<select>`s, the `/notes`+`/memory-cards` filter, and the detail-view
// switcher — id/title only. Every consumer of getSubjects maps straight to {value, label}, so
// `description`/`created_at` would be dead weight.
export type SubjectOptionT = Pick<SubjectT, 'id' | 'title'>

// getSubjects + each subject's first note id (highest position — the note /subjects/[id] would
// redirect to), for the /subjects landing picker to link straight to the note and skip that
// redirect hop. `firstNoteId` is undefined for a subject with no notes.
export type SubjectPickerOptionT = SubjectOptionT & { firstNoteId?: string }
