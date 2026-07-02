'use client'

import { Button } from '@/components/ui/button'
import { CardExampleField } from '@/features/memory-cards/components/card-example-field'
import { CardPromptField } from '@/features/memory-cards/components/card-prompt-field'
import type { GeneratedCardT } from '@/features/openrouter/ai-schemas'

type GeneratedCardItemPropsT = {
  card: GeneratedCardT
  promptError?: string
  isSaving: boolean
  onPatch: (patch: Partial<GeneratedCardT>) => void
  onRemove: () => void
  onAdd: () => void
}

// One editable candidate in the AI review list, boxed in the brand gradient-border (green→cyan) so
// each card reads as AI-generated content. gap-4 spaces the Question from the Answer editor; each
// field owns its own label→control gap-2.
export function GeneratedCardItem({
  card,
  promptError,
  isSaving,
  onPatch,
  onRemove,
  onAdd,
}: GeneratedCardItemPropsT) {
  return (
    <li data-testid="ai-card-candidate" className="gradient-border grid gap-4 rounded-xl p-4">
      <CardPromptField
        value={card.prompt}
        onChange={(prompt) => onPatch({ prompt })}
        error={promptError}
      />
      <CardExampleField
        value={card.example}
        onChange={(example) => onPatch({ example })}
        label="Example"
      />
      <div className="flex gap-2">
        {/* Add this one card on its own; disabled while any save is in flight or its Question fails
            the shared promptSchema the server enforces (≥10), so it can't 400 on save. */}
        <Button
          type="button"
          size="sm"
          data-testid="ai-card-add"
          disabled={isSaving || Boolean(promptError)}
          onClick={onAdd}
        >
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  )
}
