'use client'

import { useState, useTransition } from 'react'

import { toastActionResult } from '@/components/forms/toast-result'
import { Label } from '@/components/ui/label'
import { ModelSelect } from '@/features/openrouter/components/model-select'
import { setOpenRouterModel } from '@/features/openrouter/actions/set-model'

// Settings default-model picker. Persists on change (optimistic local value + toast); this is the
// model used for all AI generation unless the generate dialog overrides it per-run.
export function SettingsModelSelect({ defaultModel }: { defaultModel: string }) {
  const [model, setModel] = useState(defaultModel)
  const [isSaving, startSave] = useTransition()

  function change(modelId: string) {
    const previous = model
    setModel(modelId)
    startSave(async () => {
      const result = await setOpenRouterModel({ modelId })
      if (!toastActionResult(result, { successMessage: 'Default model saved' })) setModel(previous)
    })
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="settings-model">Default model</Label>
      <ModelSelect value={model} onChange={change} disabled={isSaving} testId="settings-model" />
      <p className="text-muted-foreground text-sm">
        Used for all AI generation unless you override it per-generate.
      </p>
    </div>
  )
}
