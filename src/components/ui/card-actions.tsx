'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

// Per-card Edit + Delete controls. For delete, pass either `onRequestDelete` (renders the default
// glowy-red button) or a custom `deleteControl` node (e.g. memory-cards' self-contained button).
// `linkControl` / `unlinkControl` are optional nodes between Edit and Delete — mutually exclusive in
// practice (a card is linked XOR unlinked): Link for an unlinked card on the listing, Unlink for a
// linked card in the note's card section. `reviewControl` is an optional leading node (memory-cards'
// Review button that swaps the card into the in-place review panel).
type CardActionsPropsT = {
  editHref: string
  onRequestDelete?: () => void
  deleteControl?: ReactNode
  linkControl?: ReactNode
  unlinkControl?: ReactNode
  reviewControl?: ReactNode
}

export function CardActions({
  editHref,
  onRequestDelete,
  deleteControl,
  linkControl,
  unlinkControl,
  reviewControl,
}: CardActionsPropsT) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      {reviewControl}
      <Button variant="outline" size="sm" onClick={() => router.push(editHref)}>
        Edit
      </Button>
      {linkControl}
      {unlinkControl}
      {deleteControl ??
        (onRequestDelete && (
          <Button variant="glowy-red" size="sm" onClick={onRequestDelete}>
            Delete
          </Button>
        ))}
    </div>
  )
}
