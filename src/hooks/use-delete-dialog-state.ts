'use client'

import { useState } from 'react'

// Shared pending-delete state for a list that drives ONE controlled delete dialog (not one Radix
// tree per row). Promoted to src/hooks on the 2nd consumer (notes + subjects lists) per the
// feature-first rule. `openId` derives from the pending id AND its presence in `items`, so once a
// delete revalidates the list (the row drops out) the dialog closes on its own — no effect needed.
// `requestDelete` is handed to each row's action; `onOpenChange` clears the pending id on close.
export function useDeleteDialogState<T extends { id: string }>(items: T[]) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const openId = pendingId && items.some((item) => item.id === pendingId) ? pendingId : null

  function onOpenChange(open: boolean) {
    if (!open) setPendingId(null)
  }

  return { openId, requestDelete: setPendingId, onOpenChange }
}
