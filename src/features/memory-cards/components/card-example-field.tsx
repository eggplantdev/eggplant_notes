'use client'

import { useId, useState } from 'react'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// The single answer field for a memory card (formerly split into `example` + `code_context`). It
// starts as a cheap textarea and upgrades to the full markdown editor (EditorWithPreview, which pulls
// the heavy CodeMirror + Shiki chunks) only on opt-in — so the common "plain prose answer" case never
// pays for the editor bundle. Plain value/onChange so it drops into any TanStack `form.Field`.
// `richByDefault` opens straight into the editor, skipping the toggle (the standalone card form,
// which is markdown-first). The in-note forms keep the toggle so their many cards stay cheap textareas.
export function CardExampleField({
  value,
  onChange,
  richByDefault = false,
  testId,
}: {
  value: string
  onChange: (value: string) => void
  richByDefault?: boolean
  testId?: string
}) {
  const [rich, setRich] = useState(richByDefault)
  // Associate the label with the textarea so getByLabel('Example (optional)') resolves it (the
  // markdown editor manages its own focus, so the label only targets the textarea pane).
  const textareaId = useId()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={rich ? undefined : textareaId}>Example (optional)</Label>
        {!rich && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="card-example-rich"
            onClick={() => setRich(true)}
          >
            Add formatting
          </Button>
        )}
      </div>
      {rich ? (
        <EditorWithPreview value={value} onChange={onChange} />
      ) : (
        <Textarea
          id={textareaId}
          data-testid={testId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="A worked example or answer — add formatting for fenced code"
          className="min-h-40"
        />
      )}
    </div>
  )
}
