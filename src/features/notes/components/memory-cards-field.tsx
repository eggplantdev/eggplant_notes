'use client'

import { useState } from 'react'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { useStore, withForm } from '@/components/forms/hooks/form-hooks'
import { Box } from '@/components/ui/box'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { promptSchema } from '@/features/memory-cards/schemas'
import { generateCards } from '@/features/openrouter/actions/generate-cards'
import type { GeneratedCardT } from '@/features/openrouter/ai-schemas'
import { GenerateDialog } from '@/features/openrouter/components/generate-dialog'
import { cardsMaterialFromNote, type PromptKeyT } from '@/features/openrouter/prompts'
import type { StagedCheckInputT } from '@/features/notes/schemas'

// Blank optional fields are coerced to null server-side by the schema's `optionalText` transform.
const EMPTY_CHECK: StagedCheckInputT = { prompt: '', example: '', code_context: '' }

// Per-row code-context toggle, mirroring card-form.tsx: code context is optional, and its editor
// pulls in the heavy CodeMirror chunk, so the editor mounts (and loads) only on opt-in. A row that
// already carries content (e.g. a re-rendered draft) starts expanded. Own state per row — array
// fields can't hoist a single toggle, and the editor can't be conditionalized inside the field
// render-prop without breaking the rules of hooks.
function CodeContextField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [showCode, setShowCode] = useState(Boolean(value))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label>Code context (optional)</Label>
        {!showCode && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCode(true)}>
            Add code context
          </Button>
        )}
      </div>
      {showCode && <EditorWithPreview value={value} onChange={onChange} />}
    </div>
  )
}

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
    checks: [] as StagedCheckInputT[],
  },
  // OpenRouter connection + default model, forwarded so the inline AI generator can ground on the
  // note being written. Defaults keep the AI button gated-off when NoteForm doesn't pass them.
  // systemDefaults seeds the generate dialog's editable prompt (undefined → built-in).
  props: {
    aiEnabled: false,
    defaultModel: '',
    systemDefaults: undefined as Record<PromptKeyT, string> | undefined,
  },
  render: function Render({ form, aiEnabled, defaultModel, systemDefaults }) {
    // Reactive draft note text — the AI generator grounds card generation on what's typed so far.
    const title = useStore(form.store, (s) => s.values.title)
    const content = useStore(form.store, (s) => s.values.content)

    return (
      <form.Field name="checks" mode="array">
        {(checksField) => (
          <Box>
            <div className="flex items-center justify-between gap-2">
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
                  systemDefaults={systemDefaults}
                  previewInput={{
                    task: 'cards',
                    material: cardsMaterialFromNote({ title, content }),
                  }}
                  action={(modelId, promptOverride) =>
                    generateCards({ draftNote: { title, content }, modelId, promptOverride })
                  }
                  onResult={(cards) =>
                    cards.forEach((c) =>
                      checksField.pushValue({
                        prompt: c.prompt,
                        example: c.example,
                        code_context: '',
                      }),
                    )
                  }
                  validate={() => (content.trim() ? undefined : 'Add note content first.')}
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
                  onClick={() => checksField.pushValue(EMPTY_CHECK)}
                >
                  Add card
                </Button>
              </div>
            </div>

            {checksField.state.value.map((_, i) => (
              <Box key={i} gap={3}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Card {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => checksField.removeValue(i)}
                  >
                    Remove
                  </Button>
                </div>

                <form.AppField
                  name={`checks[${i}].prompt`}
                  validators={{ onBlur: promptSchema, onSubmit: promptSchema }}
                >
                  {(field) => (
                    <field.Input label="Question" placeholder="What should you recall?" />
                  )}
                </form.AppField>

                <form.AppField name={`checks[${i}].example`}>
                  {(field) => (
                    <field.Textarea
                      label="Example (optional)"
                      placeholder="A worked example or expected answer"
                    />
                  )}
                </form.AppField>

                <form.Field name={`checks[${i}].code_context`}>
                  {(field) => (
                    <CodeContextField value={field.state.value} onChange={field.handleChange} />
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
