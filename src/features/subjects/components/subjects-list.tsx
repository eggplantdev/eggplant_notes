'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { MutedText } from '@/components/ui/muted-text'
import { DeleteSubjectDialog } from '@/features/subjects/delete-subject-dialog'
import { useDeleteDialogState } from '@/hooks/use-delete-dialog-state'
import type { SubjectT } from '@/types/subject'

// Thin client wrapper over the shared AnimatedCardList: supplies the subjects-specific href,
// title, optional line-clamped description subtitle, and the per-card Edit/Delete actions.
// Mirrors NotesList; data is fetched on the server (SubjectsPage) and passed in.
//
// Delete uses ONE shared DeleteSubjectDialog driven by the pending-delete id (not a Radix dialog
// per card). `openId` derives from the pending id AND its presence in `subjects`, so once the
// delete revalidates the list (the row drops out) the dialog closes on its own — no effect.
export function SubjectsList({ subjects }: { subjects: SubjectT[] }) {
  const { openId, requestDelete, onOpenChange } = useDeleteDialogState(subjects)

  return (
    <>
      <AnimatedCardList
        items={subjects}
        getKey={(subject) => subject.id}
        getHref={(subject) => `/subjects/${subject.id}`}
        renderTitle={(subject) => subject.title}
        renderSubtitle={(subject) => <MutedText clamp={2}>{subject.description}</MutedText>}
        renderAction={(subject) => (
          <CardActions
            editHref={`/subjects/${subject.id}?edit`}
            onRequestDelete={() => requestDelete(subject.id)}
          />
        )}
      />
      <DeleteSubjectDialog subjectId={openId} onOpenChange={onOpenChange} />
    </>
  )
}
