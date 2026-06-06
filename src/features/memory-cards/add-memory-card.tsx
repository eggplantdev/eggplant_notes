'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MemoryCardForm } from '@/features/memory-cards/memory-card-form'

// Defers the add-check form (and its CodeMirror island) until the user asks for it. The note
// detail page is server-rendered and otherwise mounts no editor on read; gating the always-on
// add form behind this toggle keeps a plain note view free of the CodeMirror chunk entirely —
// it loads only after "Add card" is clicked. A successful add and the "Hide" button both fire
// MemoryCardForm's `onClose`, collapsing back to the button (unmounting the editor), ready for
// the next add. Editing an existing check stays on the server-driven `?edit=<checkId>` path
// (MemoryCardsSection).
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
