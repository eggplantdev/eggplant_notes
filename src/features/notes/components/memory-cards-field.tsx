'use client'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { withForm } from '@/components/forms/hooks/form-hooks'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { promptSchema } from '@/features/memory-cards/schemas'
import type { StagedCheckInputT } from '@/features/notes/schemas'

// Blank optional fields are coerced to null server-side by the schema's `optionalText` transform.
const EMPTY_CHECK: StagedCheckInputT = { prompt: '', example: '', code_context: '' }

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
  render: function Render({ form }) {
    return (
      <form.Field name="checks" mode="array">
        {(checksField) => (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-2">
                <Label>Memory cards (optional)</Label>
                <span className="text-muted-foreground text-sm">
                  Add recall questions to save alongside this note.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => checksField.pushValue(EMPTY_CHECK)}
              >
                Add card
              </Button>
            </div>

            {checksField.state.value.map((_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
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

                <form.Field name={`checks[${i}].example`}>
                  {(field) => (
                    <div className="grid gap-2">
                      <Label htmlFor={`card-${i}-example`}>Example (optional)</Label>
                      <Textarea
                        id={`card-${i}-example`}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="A worked example or expected answer"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name={`checks[${i}].code_context`}>
                  {(field) => (
                    <div className="flex flex-col gap-2">
                      <Label>Code context (optional)</Label>
                      <EditorWithPreview value={field.state.value} onChange={field.handleChange} />
                    </div>
                  )}
                </form.Field>
              </div>
            ))}
          </div>
        )}
      </form.Field>
    )
  },
})
