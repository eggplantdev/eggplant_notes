'use client'

import { useState } from 'react'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GenerateDialog } from '@/features/openrouter/components/generate-dialog'
import {
  cardsMaterialFromTopic,
  type PromptKeyT,
  type PromptT,
} from '@/features/openrouter/prompts'
import type { GenerateResultT } from '@/features/openrouter/types'

// Shared ungrounded "generate from a topic" control (#2 card / #5 note). Collapses to just the
// GenerateDialog trigger; the topic <textarea> now lives INSIDE the dialog (rendered as its children).
// The topic state stays here so previewInput/action update reactively as the user types — the dialog
// owns no source of its own. The caller supplies the action and an onResult that maps the first
// generated item into its own form fields (the only real variation between card and note).
export function TopicGenerator<T>({
  label,
  placeholder,
  testIdPrefix,
  task,
  connected,
  defaultModel,
  systemDefaults,
  action,
  onResult,
  resultNoun,
  applyHint,
}: {
  label: string
  placeholder: string
  testIdPrefix: string
  task: 'cards' | 'notes'
  connected: boolean
  defaultModel: string
  systemDefaults?: Record<PromptKeyT, string>
  action: (
    topic: string,
    modelId: string,
    promptOverride?: PromptT,
  ) => Promise<GenerateResultT<T[]>>
  onResult: (item: T) => void
  // Forwarded to GenerateDialog for the success + apply toasts (see its props).
  resultNoun?: string
  applyHint?: string
}) {
  const [topic, setTopic] = useState('')

  return (
    <GenerateDialog<T>
      connected={connected}
      defaultModel={defaultModel}
      systemDefaults={systemDefaults}
      previewInput={
        task === 'cards'
          ? { task: 'cards', material: cardsMaterialFromTopic(topic) }
          : { task: 'notes', topic }
      }
      action={(modelId, promptOverride) => action(topic, modelId, promptOverride)}
      onResult={(data) => data[0] && onResult(data[0])}
      triggerLabel={label}
      triggerTestId={`${testIdPrefix}-generate`}
      canGenerate={topic.trim().length > 0}
      dialogTitle={label}
      resultNoun={resultNoun}
      applyHint={applyHint}
    >
      <div className="grid gap-2">
        <Label htmlFor={`${testIdPrefix}-topic`}>Topic</Label>
        <Textarea
          id={`${testIdPrefix}-topic`}
          data-testid={`${testIdPrefix}-topic`}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={placeholder}
          className="min-h-20"
        />
      </div>
    </GenerateDialog>
  )
}
