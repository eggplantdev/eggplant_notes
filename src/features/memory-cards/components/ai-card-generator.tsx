'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { toastActionResult } from '@/components/forms/toast-result'
import { createCardsForNote } from '@/features/memory-cards/actions/create-cards-for-note'
import { GeneratedCardsReview } from '@/features/memory-cards/components/generated-cards-review'
import { cardsMaterialFromNote } from '@/features/openrouter/build-prompt'
import { generateCards } from '@/features/openrouter/actions/generate-cards'
import type { GeneratedCardT } from '@/features/openrouter/ai-schemas'
import { GenerateDialog } from '@/features/openrouter/components/generate-dialog'

type AiCardGeneratorPropsT = {
  noteId: string
  noteTitle: string | null
  noteContent: string
  connected: boolean
  defaultModel: string
  // Fired whenever the candidate review panel opens/closes, so a parent can hide its own
  // "Add card" affordance while this panel shows its "Add N cards" button.
  onReviewingChange?: (reviewing: boolean) => void
}

// #1 grounded gen-cards: generate recall cards from the note's prose via the shared GenerateDialog
// (model select + prompt preview + tokens; also handles the connect gate), then review/edit the
// candidates before committing — nothing persists until the user saves. noteTitle/noteContent are
// the already-loaded note text, passed in so the prompt preview needs no extra fetch; generateCards
// still re-fetches server-side for its RLS trust boundary. This owns only the candidate lifecycle;
// the review UI lives in GeneratedCardsReview.
export function AiCardGenerator({
  noteId,
  noteTitle,
  noteContent,
  connected,
  defaultModel,
  onReviewingChange,
}: AiCardGeneratorPropsT) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<GeneratedCardT[] | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isSaving, startSave] = useTransition()

  // Single entry point for opening/closing review so the reviewing signal never drifts from state.
  function updateCandidates(next: GeneratedCardT[] | null) {
    setCandidates(next)
    onReviewingChange?.(next !== null)
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
      // GeneratedCardT ({ prompt, example }) matches the card insert schema exactly, so the
      // candidates save with no boundary remap.
      const result = await createCardsForNote(noteId, candidates)
      if (toastActionResult(result)) {
        updateCandidates(null)
        router.refresh()
      } else if (!result.success) {
        setError(result.error)
      }
    })
  }

  // Persist one candidate on its own, then drop it from the review list — closing the panel once the
  // last one is added (updateCandidates(null) also fires the reviewing signal).
  function saveOne(index: number) {
    const card = candidates?.[index]
    if (!card) return
    setError(undefined)
    startSave(async () => {
      const result = await createCardsForNote(noteId, [card])
      if (toastActionResult(result)) {
        const rest = candidates.filter((_, i) => i !== index)
        updateCandidates(rest.length > 0 ? rest : null)
        router.refresh()
      } else if (!result.success) {
        setError(result.error)
      }
    })
  }

  if (candidates) {
    return (
      <GeneratedCardsReview
        candidates={candidates}
        error={error}
        isSaving={isSaving}
        onPatch={patch}
        onRemove={remove}
        onAdd={saveOne}
        onSave={save}
        onDiscard={() => updateCandidates(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <GenerateDialog<GeneratedCardT>
        connected={connected}
        defaultModel={defaultModel}
        previewInput={{
          task: 'cards',
          material: cardsMaterialFromNote({ title: noteTitle, content: noteContent }),
        }}
        action={(modelId, promptOverride) => generateCards({ noteId, modelId, promptOverride })}
        onResult={(data) => updateCandidates(data)}
        triggerLabel="Generate with AI"
        triggerTestId="cards-generate-ai"
        dialogTitle="Generate cards from this note"
        resultNoun="card"
        applyHint="Cards ready below — review, then Add to save."
      />
      <FormError message={error} />
    </div>
  )
}
