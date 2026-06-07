'use client'

import { Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ModelSelect } from '@/features/openrouter/components/model-select'
import { useAiGate } from '@/features/openrouter/use-ai-gate'
import type { GenerateDebugT, GenerateResultT } from '@/features/openrouter/types'
import { previewPrompt, type PreviewInputT } from '@/features/openrouter/prompts'

// The single two-step entry point for every AI generation (#1/#2/#3/#5). Owns: the always-visible
// trigger, the connect gate (via useAiGate), per-generate model selection, a live preview of the
// EXACT prompt that will be sent (no LLM cost), and the token readout after generating. On Apply it
// hands the data to the caller's own preview/edit surface (form fields / candidate list).
export function GenerateDialog<T>({
  connected,
  defaultModel,
  previewInput,
  action,
  onResult,
  triggerLabel,
  triggerTestId,
  validate,
  dialogTitle,
}: {
  connected: boolean
  defaultModel: string
  previewInput: PreviewInputT
  action: (modelId: string) => Promise<GenerateResultT<T[]>>
  onResult: (data: T[]) => void
  triggerLabel: string
  triggerTestId: string
  // Runs on trigger click; return a message to show beside the button instead of opening (e.g. the
  // source text / topic is empty). The trigger stays enabled so the click always gives feedback.
  validate?: () => string | undefined
  dialogTitle: string
}) {
  const { guard, gateDialog } = useAiGate(connected)
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState(defaultModel)
  // One slot for the generation outcome (data + token/prompt debug) — both are set and cleared
  // together, so a single state can't desync the token readout from the data Apply commits.
  const [result, setResult] = useState<{ data: T[]; debug: GenerateDebugT } | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [triggerError, setTriggerError] = useState<string | undefined>(undefined)
  const [isGenerating, startGenerate] = useTransition()

  // previewPrompt is pure (no DB / no LLM) — derive the shown prompt from the current input rather
  // than fetching it into state on open.
  const preview = previewPrompt(previewInput)

  // Trigger click: validate input first (feedback beside the button if missing), then gate on the
  // connection, then open.
  function handleTrigger() {
    const message = validate?.()
    setTriggerError(message)
    if (message) return
    guard(openConfig)()
  }

  function openConfig() {
    setError(undefined)
    setResult(undefined)
    setModel(defaultModel) // re-seed from the default in case a prior open changed it
    setOpen(true)
  }

  function generate() {
    setError(undefined)
    startGenerate(async () => {
      const outcome = await action(model)
      if (outcome.success) setResult({ data: outcome.data, debug: outcome.debug })
      else setError(outcome.error)
    })
  }

  function apply() {
    if (result) onResult(result.data)
    setOpen(false)
  }

  return (
    <>
      <div className="grid justify-items-start gap-1">
        <Button
          type="button"
          variant="ai"
          size="sm"
          data-testid={triggerTestId}
          onClick={handleTrigger}
        >
          <Sparkles />
          {triggerLabel}
        </Button>
        <FormError message={triggerError} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="generate-dialog">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Pick a model and review the exact prompt before generating. The result is editable
              before it is saved.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="generate-model">Model</Label>
              <ModelSelect
                value={model}
                onChange={setModel}
                defaultModelId={defaultModel}
                testId="generate-model"
              />
            </div>

            <div className="grid gap-1">
              <Label>Prompt</Label>
              <pre
                data-testid="generate-prompt-preview"
                className="bg-muted max-h-56 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap"
              >
                {`${preview.system}\n\n---\n\n${preview.prompt}`}
              </pre>
            </div>

            {result && (
              <p data-testid="generate-token-usage" className="text-muted-foreground text-sm">
                Tokens — in {result.debug.usage.inputTokens ?? '?'} / out{' '}
                {result.debug.usage.outputTokens ?? '?'} / total{' '}
                {result.debug.usage.totalTokens ?? '?'} · model {result.debug.model}
              </p>
            )}

            <FormError message={error} />
          </div>

          <DialogFooter>
            {result ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={generate}>
                  Generate again
                </Button>
                <Button type="button" size="sm" data-testid="generate-apply" onClick={apply}>
                  Apply
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ai"
                size="sm"
                data-testid="generate-confirm"
                disabled={isGenerating}
                onClick={generate}
              >
                <Sparkles />
                {isGenerating ? 'Generating…' : 'Generate'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {gateDialog}
    </>
  )
}
