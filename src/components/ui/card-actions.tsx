'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

// Per-card Edit + Delete controls for an AnimatedCardList row (its renderAction slot wraps this in
// a nav-neutralizing container, so the controls just act). Promoted out of the per-feature
// *CardActions wrappers (notes, subjects, memory-cards) once they were the same shape. Edit always
// routes to `editHref`. For the delete control, either pass `onRequestDelete` — which renders the
// default destructive button (notes/subjects request deletion via the list's single shared dialog)
// — or pass a custom `deleteControl` node (memory-cards supply their own self-contained button).
type CardActionsPropsT = {
  editHref: string
  onRequestDelete?: () => void
  deleteControl?: ReactNode
}

export function CardActions({ editHref, onRequestDelete, deleteControl }: CardActionsPropsT) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => router.push(editHref)}>
        Edit
      </Button>
      {deleteControl ??
        (onRequestDelete && (
          <Button variant="destructive" size="sm" onClick={onRequestDelete}>
            Delete
          </Button>
        ))}
    </div>
  )
}
