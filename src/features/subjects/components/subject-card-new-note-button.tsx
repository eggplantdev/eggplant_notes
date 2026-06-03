'use client'

import { useRouter } from 'next/navigation'
import { type MouseEvent } from 'react'

import { Button } from '@/components/ui/button'

// "New note" action shown on each subject card in the listing. The whole card is a <Link> to
// the subject, so this button lives inside an <a>: preventDefault kills the native anchor
// navigation and stopPropagation keeps the click from bubbling to Next's Link handler — then
// we route to the create form ourselves, pre-tying the note to this subject (?subject=<id>).
export function SubjectCardNewNoteButton({ subjectId }: { subjectId: string }) {
  const router = useRouter()

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/notes/new?subject=${subjectId}`)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      New note
    </Button>
  )
}
