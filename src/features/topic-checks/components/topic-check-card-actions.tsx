'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { DeleteTopicCheckButton } from '@/features/topic-checks/delete-topic-check-button'
import { topicCheckEditHref } from '@/features/topic-checks/utils'

// Per-card Edit + Delete actions for the topic-checks list (AnimatedCardList's renderAction slot,
// which wraps this in a nav-neutralizing container — so the controls just act). Edit jumps to the
// parent note's detail with the check's edit form open + anchored (the same target the note's own
// edit link uses). Delete reuses the note-detail DeleteTopicCheckButton; its action revalidates
// both /notes/[id] and /topic-checks, so the row drops out of this list and its dialog unmounts.
type TopicCheckCardActionsPropsT = { noteId: string; checkId: string }

export function TopicCheckCardActions({ noteId, checkId }: TopicCheckCardActionsPropsT) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(topicCheckEditHref(noteId, checkId))}
      >
        Edit
      </Button>
      <DeleteTopicCheckButton noteId={noteId} id={checkId} />
    </div>
  )
}
