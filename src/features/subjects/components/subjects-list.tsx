'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { SubjectCardNewNoteButton } from '@/features/subjects/components/subject-card-new-note-button'
import type { SubjectT } from '@/types/subject'

// Thin client wrapper over the shared AnimatedCardList: supplies the subjects-specific href,
// title, and optional line-clamped description subtitle. Mirrors NotesList; data is fetched
// on the server (SubjectsPage) and passed in.
export function SubjectsList({ subjects }: { subjects: SubjectT[] }) {
  return (
    <AnimatedCardList
      items={subjects}
      getKey={(subject) => subject.id}
      getHref={(subject) => `/subjects/${subject.id}`}
      renderTitle={(subject) => subject.title}
      renderSubtitle={(subject) =>
        subject.description ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{subject.description}</p>
        ) : null
      }
      renderAction={(subject) => <SubjectCardNewNoteButton subjectId={subject.id} />}
    />
  )
}
