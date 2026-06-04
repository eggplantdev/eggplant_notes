'use client'

import { useRouter } from 'next/navigation'
import { type MouseEvent } from 'react'

import { DeleteNoteButton } from '@/features/notes/delete-note-button'
import { Button } from '@/components/ui/button'

// Per-card Edit + Delete actions for the notes list (AnimatedCardList's renderAction slot).
// The whole card is a <Link>, so a click here must not navigate. We neutralize navigation on
// the WRAPPER, not the buttons: preventDefault kills the native anchor activation and
// stopPropagation keeps the click off Next's Link onClick. This runs after each inner button's
// own handler (Edit's router.push, Delete's Radix dialog trigger) — so both still fire, and we
// avoid the trap where preventDefault on a Radix AlertDialogTrigger child suppresses the open.
export function NoteCardActions({ noteId }: { noteId: string }) {
  const router = useRouter()

  function blockNav(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="flex shrink-0 items-center gap-2" onClick={blockNav}>
      <Button variant="outline" size="sm" onClick={() => router.push(`/notes/${noteId}?edit=note`)}>
        Edit
      </Button>
      <DeleteNoteButton id={noteId} />
    </div>
  )
}
