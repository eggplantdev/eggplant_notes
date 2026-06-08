'use client'

import { useRouter } from 'next/navigation'

import { DeleteButton } from '@/components/ui/delete-button'
import { deleteMemoryCard } from '@/features/memory-cards/actions/delete-memory-card'

// `redirectTo` is for deleting a card while ON its own detail page: revalidating the listing isn't
// enough — the current route now points at a deleted row, so it must navigate away. List rows omit
// it and rely on the revalidate making the row vanish.
type DeleteMemoryCardButtonPropsT = { id: string; noteId?: string; redirectTo?: string }

export function DeleteMemoryCardButton({ id, noteId, redirectTo }: DeleteMemoryCardButtonPropsT) {
  const router = useRouter()

  return (
    <DeleteButton
      title="Delete this memory card?"
      description="This permanently deletes the memory card and its review history. This can’t be undone."
      action={() => deleteMemoryCard(id, noteId)}
      successMessage="Card deleted"
      onSuccess={redirectTo ? () => router.push(redirectTo) : undefined}
    />
  )
}
