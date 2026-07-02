'use client'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { GeneratedCardItem } from '@/features/memory-cards/components/generated-card-item'
import { promptSchema } from '@/features/memory-cards/schemas'
import { validateInput } from '@/lib/validate'
import type { GeneratedCardT } from '@/features/openrouter/ai-schemas'

type GeneratedCardsReviewPropsT = {
  candidates: GeneratedCardT[]
  error?: string
  isSaving: boolean
  onPatch: (index: number, patch: Partial<GeneratedCardT>) => void
  onRemove: (index: number) => void
  onSave: () => void
  onDiscard: () => void
}

// The second gate before any card persists: an editable list of the AI's candidates with a
// Save/Discard footer. Validates each edited Question against the SAME schema the server enforces
// (promptSchema, ≥10) so a too-short prompt is caught inline here instead of 400-ing on save.
export function GeneratedCardsReview({
  candidates,
  error,
  isSaving,
  onPatch,
  onRemove,
  onSave,
  onDiscard,
}: GeneratedCardsReviewPropsT) {
  // One parse per card via the shared validateInput, reused for both the inline error and the gate.
  const promptErrors = candidates.map((card) => {
    const result = validateInput(promptSchema, card.prompt)
    return result.success ? undefined : result.error
  })
  const hasInvalidPrompt = promptErrors.some(Boolean)
  const count = candidates.length

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        Review {count} generated card{count === 1 ? '' : 's'} before adding
      </p>
      <ul className="flex flex-col gap-3">
        {candidates.map((card, index) => (
          <GeneratedCardItem
            key={index}
            card={card}
            promptError={promptErrors[index]}
            onPatch={(patch) => onPatch(index, patch)}
            onRemove={() => onRemove(index)}
          />
        ))}
      </ul>
      <FormError message={error} />
      {/* mb-4 sets the gap before the existing-cards list below the review panel. */}
      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          size="sm"
          data-testid="ai-cards-save"
          disabled={isSaving || count === 0 || hasInvalidPrompt}
          onClick={onSave}
        >
          {isSaving ? 'Adding…' : `Add ${count} card${count === 1 ? '' : 's'}`}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  )
}
