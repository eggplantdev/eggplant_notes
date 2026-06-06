'use client'

import { Button } from '@/components/ui/button'
import { unlinkCardFromNote } from '@/features/memory-cards/actions/unlink-card-from-note'
import { useActionTransition } from '@/hooks/use-action-transition'

type UnlinkCardButtonPropsT = { id: string; noteId: string }

// Per-card Unlink in the note's card section (standalone-memory-cards): drops the card's note_id
// so it survives as a standalone card (its subject is untouched). Non-destructive and reversible,
// so no confirm dialog — fires the action in a transition; the action revalidates the note path,
// which re-renders this server section without the unlinked row.
export function UnlinkCardButton({ id, noteId }: UnlinkCardButtonPropsT) {
  const { isPending, run } = useActionTransition()

  return (
    <Button
      variant="secondary"
      size="sm"
      data-testid="card-unlink-note"
      disabled={isPending}
      onClick={() => run(() => unlinkCardFromNote(id, noteId), { successMessage: 'Card unlinked' })}
    >
      {isPending ? 'Unlinking…' : 'Unlink'}
    </Button>
  )
}
