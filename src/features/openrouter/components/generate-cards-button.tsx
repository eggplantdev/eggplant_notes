'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { toastActionResult } from '@/components/forms/toast-result'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCardsForNote } from '@/features/memory-cards/actions/create-cards-for-note'
import { generateCards } from '@/features/openrouter/actions/generate-cards'
import type { GeneratedCardT } from '@/features/openrouter/ai-schemas'

// #1 grounded gen-cards: generate recall cards from the note's prose, preview/edit them, then commit.
// Shown only when OpenRouter is connected (the parent gates on it). The preview is the gate — nothing
// persists until the user accepts.
export function GenerateCardsButton({ noteId }: { noteId: string }) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<GeneratedCardT[] | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isGenerating, startGenerate] = useTransition()
  const [isSaving, startSave] = useTransition()

  function generate() {
    setError(undefined)
    startGenerate(async () => {
      const result = await generateCards({ noteId })
      if (result.success) setCandidates(result.data)
      else setError(result.error)
    })
  }

  function patch(index: number, patchValue: Partial<GeneratedCardT>) {
    setCandidates(
      (prev) => prev?.map((c, i) => (i === index ? { ...c, ...patchValue } : c)) ?? null,
    )
  }

  function remove(index: number) {
    setCandidates((prev) => prev?.filter((_, i) => i !== index) ?? null)
  }

  function save() {
    if (!candidates?.length) return
    setError(undefined)
    startSave(async () => {
      const result = await createCardsForNote(noteId, candidates)
      if (toastActionResult(result)) {
        setCandidates(null)
        router.refresh()
      } else if (!result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {!candidates && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="cards-generate-ai"
            disabled={isGenerating}
            onClick={generate}
          >
            {isGenerating ? 'Generating…' : 'Generate cards with AI'}
          </Button>
        </div>
      )}

      {candidates && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">
            Review {candidates.length} generated card{candidates.length === 1 ? '' : 's'} before
            adding
          </p>
          <ul className="flex flex-col gap-3">
            {candidates.map((card, index) => (
              <li key={index} data-testid="ai-card-candidate" className="grid gap-2 border-t pt-3">
                <div className="grid gap-1">
                  <Label htmlFor={`ai-card-prompt-${index}`}>Question</Label>
                  <Input
                    id={`ai-card-prompt-${index}`}
                    value={card.prompt}
                    onChange={(e) => patch(index, { prompt: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`ai-card-example-${index}`}>Answer</Label>
                  <Textarea
                    id={`ai-card-example-${index}`}
                    value={card.example}
                    onChange={(e) => patch(index, { example: e.target.value })}
                  />
                </div>
                <div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              data-testid="ai-cards-save"
              disabled={isSaving || candidates.length === 0}
              onClick={save}
            >
              {isSaving
                ? 'Adding…'
                : `Add ${candidates.length} card${candidates.length === 1 ? '' : 's'}`}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCandidates(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {!candidates && <FormError message={error} />}
    </div>
  )
}
