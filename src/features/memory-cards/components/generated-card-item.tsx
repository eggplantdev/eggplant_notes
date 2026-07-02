'use client'

import { Button } from '@/components/ui/button'
import { CardExampleField } from '@/features/memory-cards/components/card-example-field'
import { CardPromptField } from '@/features/memory-cards/components/card-prompt-field'
import type { GeneratedCardT } from '@/features/openrouter/ai-schemas'

type GeneratedCardItemPropsT = {
  card: GeneratedCardT
  promptError?: string
  onPatch: (patch: Partial<GeneratedCardT>) => void
  onRemove: () => void
}

// One editable candidate in the AI review list, boxed in the brand gradient-border (green→cyan) so
// each card reads as AI-generated content. gap-4 spaces the Question from the Answer editor; each
// field owns its own label→control gap-2.
export function GeneratedCardItem({
  card,
  promptError,
  onPatch,
  onRemove,
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
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  )
}
