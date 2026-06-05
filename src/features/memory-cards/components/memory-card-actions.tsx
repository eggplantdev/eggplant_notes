'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { DeleteMemoryCardButton } from '@/features/memory-cards/delete-memory-card-button'
import { memoryCardEditHref } from '@/features/memory-cards/utils'

// Per-card Edit + Delete actions for the memory-cards list (AnimatedCardList's renderAction slot,
// which wraps this in a nav-neutralizing container — so the controls just act). Edit jumps to the
// parent note's detail with the check's edit form open + anchored (the same target the note's own
// edit link uses). Delete reuses the note-detail DeleteMemoryCardButton; its action revalidates
// both /notes/[id] and /memory-cards, so the row drops out of this list and its dialog unmounts.
type MemoryCardActionsPropsT = { noteId: string; checkId: string }

export function MemoryCardActions({ noteId, checkId }: MemoryCardActionsPropsT) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(memoryCardEditHref(noteId, checkId))}
      >
        Edit
      </Button>
      <DeleteMemoryCardButton noteId={noteId} id={checkId} />
    </div>
  )
}
