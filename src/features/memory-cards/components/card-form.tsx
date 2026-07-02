'use client'

import { FormError } from '@/components/forms/form-components/form-error'
import { getFieldErrorText } from '@/components/forms/utils'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { CardExampleField } from '@/features/memory-cards/components/card-example-field'
import { CardNoteLinkRow } from '@/features/memory-cards/components/card-note-link-row'
import { CardPromptField } from '@/features/memory-cards/components/card-prompt-field'
import { CardSubjectField } from '@/features/memory-cards/components/card-subject-field'
import { DeleteMemoryCardButton } from '@/features/memory-cards/components/delete-memory-card-button'
import { UnlinkOnSubjectChangeDialog } from '@/features/memory-cards/components/unlink-on-subject-change-dialog'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { useCardForm } from '@/features/memory-cards/use-card-form'
import { generateCards } from '@/features/openrouter/actions/generate-cards'
import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/constants'
import { TopicGenerator } from '@/features/openrouter/components/topic-generator'
import type { SubjectOptionT } from '@/features/subjects/types'

// `card` present → edit (updateMemoryCard); absent → create (createStandaloneCard). The create/edit
// lifecycle + the unlink-on-subject-change confirm gate live in useCardForm; this component only
// renders. `sourceNote` (edit of a linked card) drives the source-note row.
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

export function CardForm({ subjects, card, sourceNote, aiEnabled, defaultModel }: CardFormPropsT) {
  const { form, formError, clearError, isNavigating, pendingValues, confirmSubmit, cancelConfirm } =
    useCardForm(card)

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
          <CardSubjectField
            id={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            subjects={subjects}
          />
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

      <form.Field name="prompt" validators={{ onBlur: promptSchema, onSubmit: promptSchema }}>
        {(field) => (
          <CardPromptField
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={getFieldErrorText(field.state.meta.errors)}
            placeholder="What should you recall?"
          />
        )}
      </form.Field>

      <form.Field name="example">
        {(field) => <CardExampleField value={field.state.value} onChange={field.handleChange} />}
      </form.Field>

      {card && <CardNoteLinkRow card={card} sourceNote={sourceNote} subjects={subjects} />}

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
        <UnlinkOnSubjectChangeDialog
          noteTitle={sourceNote?.title}
          onConfirm={confirmSubmit}
          onCancel={cancelConfirm}
        />
      )}
    </form>
  )
}
