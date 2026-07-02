'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { MemoryCardForm } from '@/features/memory-cards/components/memory-card-form'
import { AiCardGenerator } from '@/features/memory-cards/components/ai-card-generator'

// Defers the add-card form (and its CodeMirror island) until "Add card" is clicked, so a plain
// note view loads no CodeMirror chunk. A successful add and "Hide" both fire `onClose`, collapsing
// back to the button (unmounting the editor).

type MemoryCardsSectionPropsT = {
  noteId: string
  noteTitle: string | null
  noteContent: string
  connected: boolean
  defaultModel: string
}
export function AddMemoryCard({
  noteId,
  noteTitle,
  noteContent,
  connected,
  defaultModel,
}: MemoryCardsSectionPropsT) {
  const [open, setOpen] = useState(false)
  // Hide the manual "Add card" button while the AI review panel is up — it renders its own
  // "Add N cards" action, so two competing add buttons would show side by side.
  const [reviewing, setReviewing] = useState(false)

  if (!open) {
    return (
      <div className={`flex items-center gap-2`}>
        {!reviewing && (
          <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
            Add card
          </Button>
        )}
        <AiCardGenerator
          noteId={noteId}
          noteTitle={noteTitle}
          noteContent={noteContent}
          connected={connected}
          defaultModel={defaultModel}
          onReviewingChange={setReviewing}
        />
      </div>
    )
  }

  return <MemoryCardForm noteId={noteId} onClose={() => setOpen(false)} />
}
