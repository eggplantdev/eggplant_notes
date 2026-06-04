'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

// "New note" action shown on each subject card in the listing, pre-tying the note to this
// subject (?subject=<id>). The card is a <Link>, but AnimatedCardList's renderAction slot now
// neutralizes the card navigation around this action (see blockCardNav), so we just route.
export function SubjectCardNewNoteButton({ subjectId }: { subjectId: string }) {
  const router = useRouter()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(`/notes/new?subject=${subjectId}`)}
    >
      New note
    </Button>
  )
}
