'use client'

import { useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GenerateResultT } from '@/features/openrouter/types'

// Shared ungrounded "generate from a topic" control (#2 card / #5 note). Owns the topic input,
// pending state, and error; the caller supplies the action and an onResult callback that maps the
// first generated item into its own form fields (the only real variation between card and note).
export function TopicGenerator<T>({
  label,
  placeholder,
  testIdPrefix,
  inputClassName,
  action,
  onResult,
}: {
  label: string
  placeholder: string
  testIdPrefix: string
  inputClassName?: string
  action: (topic: string) => Promise<GenerateResultT<T[]>>
  onResult: (item: T) => void
}) {
  const [topic, setTopic] = useState('')
  const [aiError, setAiError] = useState<string | undefined>(undefined)
  const [isGenerating, startGenerate] = useTransition()

  function generate() {
    setAiError(undefined)
    startGenerate(async () => {
      const result = await action(topic)
      if (result.success && result.data[0]) onResult(result.data[0])
      else if (!result.success) setAiError(result.error)
      else setAiError('Nothing was generated. Try a more specific topic.')
    })
  }

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
        <Button
          type="button"
          variant="outline"
          data-testid={`${testIdPrefix}-generate`}
          disabled={isGenerating || topic.trim().length === 0}
          onClick={generate}
        >
          {isGenerating ? 'Generating…' : 'Generate'}
        </Button>
      </div>
      <FormError message={aiError} />
    </div>
  )
}
