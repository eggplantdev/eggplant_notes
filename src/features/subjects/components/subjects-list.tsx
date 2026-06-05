'use client'

import { useState } from 'react'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { SubjectCardActions } from '@/features/subjects/components/subject-card-actions'
import { DeleteSubjectDialog } from '@/features/subjects/delete-subject-dialog'
import type { SubjectT } from '@/types/subject'

// Thin client wrapper over the shared AnimatedCardList: supplies the subjects-specific href,
// title, optional line-clamped description subtitle, and the per-card Edit/Delete actions.
// Mirrors NotesList; data is fetched on the server (SubjectsPage) and passed in.
//
// Delete uses ONE shared DeleteSubjectDialog driven by the pending-delete id (not a Radix dialog
// per card). `openId` derives from the pending id AND its presence in `subjects`, so once the
// delete revalidates the list (the row drops out) the dialog closes on its own — no effect.
export function SubjectsList({ subjects }: { subjects: SubjectT[] }) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const openId =
    pendingDeleteId && subjects.some((s) => s.id === pendingDeleteId) ? pendingDeleteId : null

  return (
    <>
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
        renderAction={(subject) => (
          <SubjectCardActions subjectId={subject.id} onRequestDelete={setPendingDeleteId} />
        )}
      />
      <DeleteSubjectDialog
        subjectId={openId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      />
    </>
  )
}
