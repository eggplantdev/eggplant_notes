'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { linkCardToNote } from '@/features/memory-cards/actions/link-card-to-note'
import { getNotesForLinkingAction } from '@/features/notes/actions/get-notes-for-linking'
import type { SubjectOptionT } from '@/features/subjects/types'
import { useActionTransition } from '@/hooks/use-action-transition'

// "None" ↔ this sentinel ↔ null subject filter (unfiled notes). Same convention as the card form.
const NO_SUBJECT = 'none'

type LinkCardToNoteDialogPropsT = {
  cardId: string
  // The card's current subject, pre-selected as the note filter (null → "None"/unfiled).
  cardSubjectId: string | null
  subjects: SubjectOptionT[]
  onOpenChange: (open: boolean) => void
}

// Attach a standalone card to an existing note. The subject-select (required, includes "None")
// scopes a note search; the chosen note's subject becomes the card's on link (derived server-side).
// Mounted only while open, so selection state starts fresh each time. On success: toast + refresh.
export function LinkCardToNoteDialog({
  cardId,
  cardSubjectId,
  subjects,
  onOpenChange,
}: LinkCardToNoteDialogPropsT) {
  const router = useRouter()
  const { error, isPending, run } = useActionTransition()
  const [subjectValue, setSubjectValue] = useState(cardSubjectId ?? NO_SUBJECT)
  const [notes, setNotes] = useState<{ id: string; title: string | null }[]>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [noteId, setNoteId] = useState<string | undefined>(undefined)

  // Fetch the note options whenever the subject filter changes (and on mount). `ignore` drops a
  // stale response if the subject changes again before the fetch resolves (last-write-wins). The
  // loading flag + note reset are flipped in the change handler (initial mount already starts in
  // the loading state), keeping this effect a pure data fetch.
  useEffect(() => {
    let ignore = false
    const subjectId = subjectValue === NO_SUBJECT ? null : subjectValue
    getNotesForLinkingAction(subjectId)
      .then((rows) => {
        if (ignore) return
        setNotes(rows)
        setLoadingNotes(false)
      })
      // A rejected fetch must still clear the spinner (otherwise it hangs forever); the combobox
      // then shows its empty state rather than trapping the user.
      .catch(() => {
        if (ignore) return
        setNotes([])
        setLoadingNotes(false)
      })
    return () => {
      ignore = true
    }
  }, [subjectValue])

  // Picking a new subject voids the current note choice and shows the spinner until the effect's
  // fetch resolves.
  function handleSubjectChange(value: string) {
    setSubjectValue(value)
    setLoadingNotes(true)
    setNoteId(undefined)
  }

  const subjectOptions = [
    { value: NO_SUBJECT, label: 'None' },
    ...subjects.map((s) => ({ value: s.id, label: s.title })),
  ]
  const noteOptions = notes.map((n) => ({ value: n.id, label: n.title ?? 'Untitled' }))

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to a note</DialogTitle>
          <DialogDescription>
            Pick a subject to find a note, then choose the note. The card moves to that note&apos;s
            subject.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="link-subject">Subject</Label>
          <Combobox
            id="link-subject"
            value={subjectValue}
            onChange={handleSubjectChange}
            options={subjectOptions}
            searchPlaceholder="Search subject…"
            emptyMessage="No subject found."
            className="w-full"
            modal
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="link-note">Note</Label>
          {loadingNotes ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
              <Spinner /> Loading notes…
            </div>
          ) : (
            <Combobox
              id="link-note"
              value={noteId}
              onChange={setNoteId}
              options={noteOptions}
              placeholder="Select a note…"
              searchPlaceholder="Search notes…"
              emptyMessage="No notes in this subject."
              className="w-full"
              modal
            />
          )}
        </div>

        <FormError message={error} />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            data-testid="link-card-confirm"
            disabled={!noteId || isPending}
            onClick={() => {
              if (!noteId) return
              run(() => linkCardToNote(cardId, noteId), { successMessage: 'Card linked' }).then(
                (result) => {
                  if (result.success) {
                    onOpenChange(false)
                    router.refresh()
                  }
                },
              )
            }}
          >
            {isPending ? 'Linking…' : 'Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
