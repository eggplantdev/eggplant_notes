'use client'

import { useState } from 'react'

import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormError } from '@/components/forms/hooks/use-form-error'
import { createStandaloneCard } from '@/features/memory-cards/actions/create-standalone-card'
import { updateMemoryCard } from '@/features/memory-cards/actions/update-memory-card'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { useActionNavigation } from '@/hooks/use-action-navigation'

export type CardFormValuesT = {
  subject_id: string | null
  prompt: string
  example: string
}

// Owns the create-vs-edit lifecycle for CardForm so the component is just rendering:
// - submit routing (`card` present → update, stays + toasts; absent → create, navigates to /memory-cards),
// - the unlink-on-subject-change confirm gate (a linked card whose subject changed must unlink — hold
//   the values while the dialog is open, then submit on confirm),
// - form state + the shared form-error surface.
export function useCardForm(card?: MemoryCardT) {
  const { formError, clearError, reportResult } = useFormError()
  // Both create and edit land on /memory-cards (a client-known URL); navigate there on create success.
  const { isNavigating, navigate } = useActionNavigation()
  // Holds the submitted values while the "this will unlink" dialog is open; undefined when none pending.
  const [pendingValues, setPendingValues] = useState<CardFormValuesT | undefined>(undefined)

  async function submitCard(values: CardFormValuesT) {
    setPendingValues(undefined)
    if (card) {
      const result = await updateMemoryCard(card.id, values)
      // Stay on this edit page — just confirm via toast.
      reportResult(result, { successMessage: 'Card saved' })
      return
    }
    const result = await createStandaloneCard(values)
    if (reportResult(result)) navigate('/memory-cards', 'card-created')
  }

  const form = useAppForm({
    defaultValues: {
      subject_id: card?.subject_id ?? null,
      prompt: card?.prompt ?? '',
      example: card?.example ?? '',
    },
    onSubmit: async ({ value }) => {
      // A linked card shares its note's subject, so changing its subject must unlink it — confirm
      // before saving. (The core re-derives the unlink server-side; this gate is purely the UX warning.)
      if (card?.note_id && value.subject_id !== card.subject_id) {
        setPendingValues(value)
        return
      }
      await submitCard(value)
    },
  })

  return {
    form,
    formError,
    clearError,
    isNavigating,
    // Truthy while the unlink confirm dialog should be open.
    pendingValues,
    confirmSubmit: () => {
      if (pendingValues) void submitCard(pendingValues)
    },
    cancelConfirm: () => setPendingValues(undefined),
  }
}
