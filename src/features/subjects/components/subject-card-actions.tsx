'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

// Per-card Edit + Delete actions for the subjects list (AnimatedCardList's renderAction slot).
// The slot wraps this in a nav-neutralizing container, so the buttons just act. Mirrors
// NoteCardActions. Edit routes to the subject view's inline edit form (`?edit`). Delete doesn't
// own a dialog — it requests deletion via `onRequestDelete`, and SubjectsList opens its single
// shared DeleteSubjectDialog for the chosen id (one dialog for the whole list, not one per row).
type SubjectCardActionsPropsT = {
  subjectId: string
  onRequestDelete: (subjectId: string) => void
}

export function SubjectCardActions({ subjectId, onRequestDelete }: SubjectCardActionsPropsT) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(`/subjects/${subjectId}?edit`)}
      >
        Edit
      </Button>
      <Button variant="destructive" size="sm" onClick={() => onRequestDelete(subjectId)}>
        Delete
      </Button>
    </div>
  )
}
