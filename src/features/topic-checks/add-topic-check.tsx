'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { TopicCheckForm } from '@/features/topic-checks/topic-check-form'

// Defers the add-check form (and its CodeMirror island) until the user asks for it. The note
// detail page is server-rendered and otherwise mounts no editor on read; gating the always-on
// add form behind this toggle keeps a plain note view free of the CodeMirror chunk entirely —
// it loads only after "Add check" is clicked. On a successful add, TopicCheckForm fires
// `onAdded`; "Hide" fires `onCancel` — both collapse back to the button (unmounting the editor),
// ready for the next add. Editing an existing check stays on the server-driven `?edit=<checkId>`
// path (TopicChecksSection).
export function AddTopicCheck({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Add check
      </Button>
    )
  }

  return (
    <TopicCheckForm
      noteId={noteId}
      onAdded={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    />
  )
}
