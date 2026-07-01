'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
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
import { createStandaloneCard } from '@/features/memory-cards/actions/create-standalone-card'
import { unlinkCardFromNote } from '@/features/memory-cards/actions/unlink-card-from-note'
import { CardExampleField } from '@/features/memory-cards/components/card-example-field'
import { DeleteMemoryCardButton } from '@/features/memory-cards/components/delete-memory-card-button'
import { LinkCardButton } from '@/features/memory-cards/components/link-card-button'
import { updateMemoryCard } from '@/features/memory-cards/actions/update-memory-card'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { generateCards } from '@/features/openrouter/actions/generate-cards'
import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/constants'
import { TopicGenerator } from '@/features/openrouter/components/topic-generator'
import type { SubjectOptionT } from '@/features/subjects/types'
import { useActionTransition } from '@/hooks/use-action-transition'
import { useActionNavigation } from '@/hooks/use-action-navigation'

// Combobox needs a concrete option value; unfiled card ↔ this sentinel ↔ null on the way out.
const NO_SUBJECT = 'none'

// `card` present → edit (updateMemoryCard); absent → create (createStandaloneCard). On success the
// form client-navigates to /memory-cards (a known URL), toasting + showing that route's loader.
// `sourceNote` (edit of a linked card) renders a source-note row + an Unlink action.
type CardFormPropsT = {
  subjects: SubjectOptionT[]
  card?: MemoryCardT
  sourceNote?: { id: string; title: string | null }
  // Whether OpenRouter is connected. The AI "generate from a topic" filler (#2) shows in create
  // mode regardless; when not connected its Generate button opens the connect dialog.
  aiEnabled?: boolean
  // The user's persisted default model, pre-selected in the generate dialog. Only consumed in
  // create mode (the topic generator); edit mode omits it.
  defaultModel?: string
}

type CardFormValuesT = {
  subject_id: string | null
  prompt: string
  example: string
}

export function CardForm({ subjects, card, sourceNote, aiEnabled, defaultModel }: CardFormPropsT) {
  const router = useRouter()
  const { formError, clearError, reportResult } = useFormError()
  // Both create and edit land on /memory-cards (a client-known URL); navigate there on success.
  const { isNavigating, navigate } = useActionNavigation()
  // Holds the submitted values while the "this will unlink" dialog is open (a linked card whose
  // subject changed); undefined when no confirm is pending.
  const [pendingValues, setPendingValues] = useState<CardFormValuesT | undefined>(undefined)
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
    },
    onSubmit: async ({ value }) => {
      // A linked card shares its note's subject, so changing its subject must unlink it — confirm
      // before saving. (The core re-derives the unlink server-side; this gate is purely the UX warning.)
      if (card?.note_id && value.subject_id !== card.subject_id) {
        setPendingValues(value)
        return
      }
      await submitCard(value)
    },
  })

  async function submitCard(values: CardFormValuesT) {
    setPendingValues(undefined)
    if (card) {
      const result = await updateMemoryCard(card.id, values)
      // Stay on this edit page — just confirm via toast.
      reportResult(result, { successMessage: 'Card saved' })
      return
    }
    const result = await createStandaloneCard(values)
    if (reportResult(result)) navigate('/memory-cards', 'card-created')
  }

  return (
    <form
      className="flex flex-col gap-4"
      data-testid="card-form"
      onSubmit={(e) => {
        e.preventDefault()
        clearError()
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

      {!card && (
        <TopicGenerator
          label="Generate with AI"
          sourceLabel="Question topic"
          placeholder="e.g. JavaScript closures"
          testIdPrefix="card-ai"
          task="cards"
          connected={aiEnabled ?? false}
          defaultModel={defaultModel ?? DEFAULT_OPENROUTER_MODEL}
          action={(topic, modelId, promptOverride) =>
            generateCards({ topic, modelId, promptOverride })
          }
          onResult={(genCard) => {
            form.setFieldValue('prompt', genCard.prompt)
            form.setFieldValue('example', genCard.example)
            // setFieldValue only re-runs the "change" validation cause; a stale error from an
            // earlier blur on the empty field (e.g. tabbing through before generating) sticks
            // around in errorMap.onBlur otherwise, showing under the now-valid AI-filled value.
            form.validateField('prompt', 'blur')
          }}
          resultNoun="card"
          applyHint="Card filled in below — edit if needed, then Create card to save."
        />
      )}

      <form.AppField name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => <field.Input label="Question" placeholder="What should you recall?" />}
      </form.AppField>

      <form.Field name="example">
        {(field) => (
          <CardExampleField
            value={field.state.value}
            onChange={field.handleChange}
            richByDefault
            testId="card-form-example"
          />
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
                toastError: true, // bare button — no inline error surface
              }).then((result) => {
                if (result.success) router.refresh()
              })
            }
          >
            {isUnlinking ? 'Unlinking…' : 'Unlink'}
          </Button>
        </div>
      )}

      {/* Mirror of the source-note row for an UNLINKED card. `sourceNote` is present iff note_id is
          set, so the two rows are mutually exclusive. Linking refreshes the page (in the dialog), so
          this row is then replaced by the Unlink row above. */}
      {card && !card.note_id && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground">No source note</span>
          <LinkCardButton cardId={card.id} cardSubjectId={card.subject_id} subjects={subjects} />
        </div>
      )}

      <FormError message={formError} />

      <div className="flex items-center gap-2">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => {
            const pending = isSubmitting || isNavigating
            return (
              <Button type="submit" data-testid="card-form-submit" disabled={pending}>
                {pending ? 'Saving…' : card ? 'Save changes' : 'Create card'}
              </Button>
            )
          }}
        </form.Subscribe>
        <ButtonLink href="/memory-cards" variant="ghost">
          Cancel
        </ButtonLink>
        {card && (
          <div className="ml-auto">
            <DeleteMemoryCardButton
              id={card.id}
              noteId={card.note_id ?? undefined}
              redirectTo="/memory-cards"
            />
          </div>
        )}
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
                onClick={() => submitCard(pendingValues)}
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
