'use client'

import { useStore, withForm } from '@/components/forms/hooks/form-hooks'
import { getFieldErrorText } from '@/components/forms/utils'
import { Box } from '@/components/ui/box'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CardExampleField } from '@/features/memory-cards/components/card-example-field'
import { CardPromptField } from '@/features/memory-cards/components/card-prompt-field'
import { promptSchema } from '@/features/memory-cards/schemas'
import { generateCards } from '@/features/openrouter/actions/generate-cards'
import type { GeneratedCardT } from '@/features/openrouter/ai-schemas'
import { GenerateDialog } from '@/features/openrouter/components/generate-dialog'
import { cardsMaterialFromNote } from '@/features/openrouter/build-prompt'
import type { StagedCardInputT } from '@/features/notes/schemas'

// Blank optional fields are coerced to null server-side by the schema's `optionalText` transform.
const EMPTY_CARD: StagedCardInputT = { prompt: '', example: '' }

// Inline memory-card staging for the create-note form: an array field where each row collects a
// recall question + optional example/code-context, saved atomically with the note. Edit mode
// manages cards on the detail page instead, so this is only mounted when creating.
//
// `defaultValues` is type-only (withForm never runs it) — it mirrors the NoteForm's shape so the
// injected `form` is typed against the same fields.
export const MemoryCardsField = withForm({
  defaultValues: {
    title: '',
    content: '',
    subject_id: null as string | null,
    cards: [] as StagedCardInputT[],
  },
  // OpenRouter connection + default model, forwarded so the inline AI generator can ground on the
  // note being written. Defaults keep the AI button gated-off when NoteForm doesn't pass them.
  props: {
    aiEnabled: false,
    defaultModel: '',
  },
  render: function Render({ form, aiEnabled, defaultModel }) {
    // Reactive draft note text — the AI generator grounds card generation on what's typed so far.
    const title = useStore(form.store, (s) => s.values.title)
    const content = useStore(form.store, (s) => s.values.content)

    return (
      <form.Field name="cards" mode="array">
        {(cardsField) => (
          <Box>
            {/* Stack on mobile: at ~390px the label column + the two buttons crowd on one row, so
                the label sits above the buttons below `sm` and restores the side-by-side row at `sm`+. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <Label>Memory cards (optional)</Label>
                <span className="text-muted-foreground text-sm">
                  Add recall questions to save alongside this note.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <GenerateDialog<GeneratedCardT>
                  connected={aiEnabled}
                  defaultModel={defaultModel}
                  previewInput={{
                    task: 'cards',
                    material: cardsMaterialFromNote({ title, content }),
                  }}
                  action={(modelId, promptOverride) =>
                    generateCards({ draftNote: { title, content }, modelId, promptOverride })
                  }
                  onResult={(cards) =>
                    cards.forEach((c) =>
                      cardsField.pushValue({ prompt: c.prompt, example: c.example }),
                    )
                  }
                  triggerLabel="Generate with AI"
                  triggerTestId="note-cards-generate-ai"
                  dialogTitle="Generate cards from this note"
                  resultNoun="card"
                  applyHint="Cards added below — edit if needed, then Create note to save."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cardsField.pushValue(EMPTY_CARD)}
                >
                  Add card
                </Button>
              </div>
            </div>

            {cardsField.state.value.map((_, i) => (
              <Box key={i} gap={3}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Card {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => cardsField.removeValue(i)}
                  >
                    Remove
                  </Button>
                </div>

                <form.Field
                  name={`cards[${i}].prompt`}
                  validators={{ onBlur: promptSchema, onSubmit: promptSchema }}
                >
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

                <form.Field name={`cards[${i}].example`}>
                  {(field) => (
                    <CardExampleField value={field.state.value} onChange={field.handleChange} />
                  )}
                </form.Field>
              </Box>
            ))}
          </Box>
        )}
      </form.Field>
    )
  },
})
