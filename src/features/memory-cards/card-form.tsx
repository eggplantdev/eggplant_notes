'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastActionResult } from '@/components/forms/toast-result'
import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createStandaloneCard } from '@/features/memory-cards/actions/create-standalone-card'
import { unlinkCardFromNote } from '@/features/memory-cards/actions/unlink-card-from-note'
import { updateMemoryCard } from '@/features/memory-cards/actions/update-memory-card'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { useActionTransition } from '@/hooks/use-action-transition'
import type { SubjectT } from '@/types/subject'

// "None" sentinel for the subject Combobox: an unfiled card maps to this constant for the picker
// and back to null on the way out (the Combobox needs a concrete option value). Mirrors note-form.
const NO_SUBJECT = 'none'

// The unified ROUTE form for /memory-cards/new (standalone create) and /memory-cards/[id]/edit
// (edit any card). Sibling to the in-note `memory-card-form.tsx` (which stays the subject-less
// inline ADD form) — kept separate per the plan so each stays thin. `card` present → edit (seeds
// defaults, calls updateMemoryCard); absent → create (createStandaloneCard). Both actions redirect
// to /memory-cards on success (redirect throws), so the form only ever observes the failure branch.
// `sourceNote` (edit of a linked card) renders a source-note row + an Unlink action.
type CardFormPropsT = {
  subjects: SubjectT[]
  card?: MemoryCardT
  sourceNote?: { id: string; title: string | null }
}

type CardFormValuesT = {
  subject_id: string | null
  prompt: string
  example: string
  code_context: string
}

export function CardForm({ subjects, card, sourceNote }: CardFormPropsT) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | undefined>(undefined)
  // Holds the submitted values while the "this will unlink" dialog is open (a linked card whose
  // subject changed); null when no confirm is pending. (standalone-memory-cards invariant)
  const [pendingValues, setPendingValues] = useState<CardFormValuesT | undefined>(undefined)
  // Code context is optional and pulls in the heavy CodeMirror chunk, so its editor is mounted
  // (and thus dynamically loaded) only after the user opts in — already-present content (edit
  // mode) starts expanded. Mirrors how AddMemoryCard defers the editor on the note page.
  const [showCode, setShowCode] = useState(Boolean(card?.code_context))
  const { isPending: isUnlinking, run: runUnlink } = useActionTransition()

  const subjectOptions = useMemo(
    () => [
      { value: NO_SUBJECT, label: 'None' },
      ...subjects.map((subject) => ({ value: subject.id, label: subject.title })),
    ],
    [subjects],
  )

  const form = useAppForm({
    defaultValues: {
      subject_id: card?.subject_id ?? null,
      prompt: card?.prompt ?? '',
      example: card?.example ?? '',
      code_context: card?.code_context ?? '',
    },
    onSubmit: async ({ value }) => {
      // Invariant: a linked card shares its note's subject, so changing a linked card's subject
      // must unlink it. Pause and confirm before saving; a standalone card or an unchanged subject
      // just saves.
      if (card?.note_id && value.subject_id !== card.subject_id) {
        setPendingValues(value)
        return
      }
      await submitCard(value, false)
    },
  })

  // Resume the save once the unlink is (or isn't) needed. Success redirects (throws), so only the
  // failure branch is observed; clear any pending confirm either way.
  async function submitCard(values: CardFormValuesT, unlinkFromNote: boolean) {
    setPendingValues(undefined)
    const result = card
      ? await updateMemoryCard(card.id, values, unlinkFromNote)
      : await createStandaloneCard(values)
    if (!toastActionResult(result)) setFormError(result.error)
  }

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="card-form"
      onSubmit={(e) => {
        e.preventDefault()
        setFormError(undefined)
        form.handleSubmit()
      }}
    >
      <form.Field name="subject_id">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Subject (optional)</Label>
            <Combobox
              id={field.name}
              value={field.state.value ?? NO_SUBJECT}
              onChange={(v) => field.handleChange(v === NO_SUBJECT ? null : v)}
              options={subjectOptions}
              searchPlaceholder="Search subject…"
              emptyMessage="No subject found."
              className="w-full sm:w-72"
            />
          </div>
        )}
      </form.Field>

      <form.AppField name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => <field.Input label="Question" placeholder="What should you recall?" />}
      </form.AppField>

      <form.Field name="example">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor="card-example">Example (optional)</Label>
            <Textarea
              id="card-example"
              data-testid="card-form-example"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="A worked example or expected answer"
            />
          </div>
        )}
      </form.Field>

      <form.Field name="code_context">
        {(field) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label>Code context (optional)</Label>
              {!showCode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="card-form-add-code"
                  onClick={() => setShowCode(true)}
                >
                  Add code context
                </Button>
              )}
            </div>
            {/* Mounted only after opt-in, so the CodeMirror chunk loads on demand. */}
            {showCode && (
              <EditorWithPreview value={field.state.value} onChange={field.handleChange} />
            )}
          </div>
        )}
      </form.Field>

      {sourceNote && card && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground">
            Source note:{' '}
            <ButtonLink href={`/notes/${sourceNote.id}`} variant="link" className="h-auto p-0">
              {sourceNote.title ?? 'Untitled'}
            </ButtonLink>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="card-unlink"
            disabled={isUnlinking}
            onClick={() =>
              runUnlink(() => unlinkCardFromNote(card.id, sourceNote.id), {
                successMessage: 'Card unlinked',
              }).then((result) => {
                if (result.success) router.refresh()
              })
            }
          >
            {isUnlinking ? 'Unlinking…' : 'Unlink'}
          </Button>
        </div>
      )}

      <FormError message={formError} />

      <div className="flex items-center gap-2">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" data-testid="card-form-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : card ? 'Save changes' : 'Create card'}
            </Button>
          )}
        </form.Subscribe>
        <ButtonLink href="/memory-cards" variant="ghost">
          Cancel
        </ButtonLink>
      </div>

      {card && pendingValues && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingValues(undefined)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlink from note?</AlertDialogTitle>
              <AlertDialogDescription>
                Changing the subject will unlink this card from “{sourceNote?.title ?? 'its note'}”.
                The card keeps the new subject and becomes standalone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="card-unlink-confirm"
                onClick={() => submitCard(pendingValues, true)}
              >
                Unlink &amp; save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  )
}
