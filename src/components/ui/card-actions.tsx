'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

// Per-card Edit + Delete controls. For delete, pass either `onRequestDelete` (renders the default
// glowy-red button) or a custom `deleteControl` node (e.g. memory-cards' self-contained button).
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
          <Button variant="glowy-red" size="sm" onClick={onRequestDelete}>
            Delete
          </Button>
        ))}
    </div>
  )
}
