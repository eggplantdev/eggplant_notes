'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MemoryCardForm } from '@/features/memory-cards/memory-card-form'

// Defers the add-card form (and its CodeMirror island) until "Add card" is clicked, so a plain
// note view loads no CodeMirror chunk. A successful add and "Hide" both fire `onClose`, collapsing
// back to the button (unmounting the editor).
export function AddMemoryCard({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Add card
      </Button>
    )
  }

  return <MemoryCardForm noteId={noteId} onClose={() => setOpen(false)} />
}
