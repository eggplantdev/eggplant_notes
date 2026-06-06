'use client'

import { useState } from 'react'

// Pending-delete state for a list driving ONE controlled delete dialog (not one Radix tree per
// row). `openId` derives from the pending id AND its presence in `items`, so once a delete
// revalidates the list (the row drops out) the dialog closes on its own — no effect needed.
export function useDeleteDialogState<T extends { id: string }>(items: T[]) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const openId = pendingId && items.some((item) => item.id === pendingId) ? pendingId : null

  function onOpenChange(open: boolean) {
    if (!open) setPendingId(null)
  }

  return { openId, requestDelete: setPendingId, onOpenChange }
}
