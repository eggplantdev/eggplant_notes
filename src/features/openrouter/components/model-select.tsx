'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OPENROUTER_MODELS } from '@/features/openrouter/models'

// Controlled model picker over the curated list. Pure — persistence (settings) or per-generate
// override (dialog) lives in the consumer. `defaultModelId` tags the settings default with
// "(default)" so it's obvious when the dialog is overriding it.
export function ModelSelect({
  value,
  onChange,
  defaultModelId,
  disabled,
  testId,
}: {
  value: string
  onChange: (modelId: string) => void
  defaultModelId?: string
  disabled?: boolean
  testId?: string
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger data-testid={testId} className="w-full sm:w-80">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPENROUTER_MODELS.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.label}
            {m.id === defaultModelId ? ' (default)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
