'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GenerateDialog } from '@/features/openrouter/components/generate-dialog'
import { cardsMaterialFromTopic, type PromptT } from '@/features/openrouter/prompts'
import type { GenerateResultT } from '@/features/openrouter/types'

// Shared ungrounded "generate from a topic" control (#2 card / #5 note). Owns the topic input; the
// Generate button opens the shared GenerateDialog (model select + prompt preview + tokens), which
// also handles the connect gate. The caller supplies the action and an onResult that maps the first
// generated item into its own form fields (the only real variation between card and note).
export function TopicGenerator<T>({
  label,
  placeholder,
  testIdPrefix,
  inputClassName,
  task,
  connected,
  defaultModel,
  action,
  onResult,
}: {
  label: string
  placeholder: string
  testIdPrefix: string
  inputClassName?: string
  task: 'cards' | 'notes'
  connected: boolean
  defaultModel: string
  action: (
    topic: string,
    modelId: string,
    promptOverride?: PromptT,
  ) => Promise<GenerateResultT<T[]>>
  onResult: (item: T) => void
}) {
  const [topic, setTopic] = useState('')

  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <Label htmlFor={`${testIdPrefix}-topic`}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${testIdPrefix}-topic`}
          data-testid={`${testIdPrefix}-topic`}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
        <GenerateDialog<T>
          connected={connected}
          defaultModel={defaultModel}
          previewInput={
            task === 'cards'
              ? { task: 'cards', material: cardsMaterialFromTopic(topic) }
              : { task: 'notes', topic }
          }
          action={(modelId, promptOverride) => action(topic, modelId, promptOverride)}
          onResult={(data) => data[0] && onResult(data[0])}
          triggerLabel="Generate"
          triggerTestId={`${testIdPrefix}-generate`}
          validate={() => (topic.trim().length === 0 ? 'Enter a topic first.' : undefined)}
          dialogTitle={label}
        />
      </div>
    </div>
  )
}
