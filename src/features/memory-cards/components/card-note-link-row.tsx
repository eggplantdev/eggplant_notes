'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { unlinkCardFromNote } from '@/features/memory-cards/actions/unlink-card-from-note'
import { LinkCardButton } from '@/features/memory-cards/components/link-card-button'
import type { MemoryCardT } from '@/features/memory-cards/types'
import type { SubjectOptionT } from '@/features/subjects/types'
import { useActionTransition } from '@/hooks/use-action-transition'

type CardNoteLinkRowPropsT = {
  card: MemoryCardT
  // Present iff the card is linked (note_id set) — carries the note to link back to.
  sourceNote?: { id: string; title: string | null }
  subjects: SubjectOptionT[]
}

// The card's note-link status row. A linked card shows its source note + Unlink; an unlinked one shows
// "No source note" + Link. `sourceNote` is present iff `note_id` is set, so the two are mutually
// exclusive. Linking refreshes the page, replacing the Link row with the Unlink row.
export function CardNoteLinkRow({ card, sourceNote, subjects }: CardNoteLinkRowPropsT) {
  const router = useRouter()
  const { isPending: isUnlinking, run: runUnlink } = useActionTransition()

  if (sourceNote) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">
          Source note:{' '}
          <ButtonLink href={`/notes/${sourceNote.id}`} variant="link" className="h-auto p-0">
            {sourceNote.title ?? 'Untitled'}
          </ButtonLink>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="card-unlink"
          disabled={isUnlinking}
          onClick={() =>
            runUnlink(() => unlinkCardFromNote(card.id, sourceNote.id), {
              successMessage: 'Card unlinked',
              toastError: true, // bare button — no inline error surface
            }).then((result) => {
              if (result.success) router.refresh()
            })
          }
        >
          {isUnlinking ? 'Unlinking…' : 'Unlink'}
        </Button>
      </div>
    )
  }

  if (!card.note_id) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">No source note</span>
        <LinkCardButton cardId={card.id} cardSubjectId={card.subject_id} subjects={subjects} />
      </div>
    )
  }

  return null
}
