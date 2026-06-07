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
import { createStandaloneCard } from '@/features/memory-cards/actions/create-standalone-card'
import { unlinkCardFromNote } from '@/features/memory-cards/actions/unlink-card-from-note'
import { updateMemoryCard } from '@/features/memory-cards/actions/update-memory-card'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { generateCards } from '@/features/openrouter/actions/generate-cards'
import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/models'
import { TopicGenerator } from '@/features/openrouter/components/topic-generator'
import type { SubjectOptionT } from '@/features/subjects/types'
import { useActionTransition } from '@/hooks/use-action-transition'

// Combobox needs a concrete option value; unfiled card ↔ this sentinel ↔ null on the way out.
const NO_SUBJECT = 'none'

// `card` present → edit (updateMemoryCard); absent → create (createStandaloneCard). Both actions
// redirect on success (redirect throws), so the form only ever observes the failure branch.
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
  code_context: string
}

export function CardForm({ subjects, card, sourceNote, aiEnabled, defaultModel }: CardFormPropsT) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | undefined>(undefined)
  // Holds the submitted values while the "this will unlink" dialog is open (a linked card whose
  // subject changed); undefined when no confirm is pending.
  const [pendingValues, setPendingValues] = useState<CardFormValuesT | undefined>(undefined)
  // Code context pulls in the heavy CodeMirror chunk, so its editor mounts (and loads) only on
  // opt-in; already-present content (edit mode) starts expanded.
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
      // A linked card shares its note's subject, so changing its subject must unlink it — confirm
      // before saving.
      if (card?.note_id && value.subject_id !== card.subject_id) {
        setPendingValues(value)
        return
      }
      await submitCard(value, false)
    },
  })

  // Success redirects (throws), so only the failure branch is observed.
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

      {!card && (
        <TopicGenerator
          label="Generate from a topic (AI)"
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
          }}
        />
      )}

      <form.AppField name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => <field.Input label="Question" placeholder="What should you recall?" />}
      </form.AppField>

      <form.AppField name="example">
        {(field) => (
          <field.Textarea
            label="Example (optional)"
            placeholder="A worked example or expected answer"
            testId="card-form-example"
          />
        )}
      </form.AppField>

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
