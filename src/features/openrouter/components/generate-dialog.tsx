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
import { Textarea } from '@/components/ui/textarea'
import { ModelSelect } from '@/features/openrouter/components/model-select'
import { useAiGate } from '@/features/openrouter/use-ai-gate'
import type { GenerateDebugT, GenerateResultT } from '@/features/openrouter/types'
import { previewPrompt, type PreviewInputT, type PromptT } from '@/features/openrouter/prompts'

// The single two-step entry point for every AI generation (#1/#2/#3/#5). Owns: the always-visible
// trigger, the connect gate (via useAiGate), per-generate model selection, an EDITABLE view of the
// exact prompt that will be sent (no LLM cost to preview), and the token readout after generating.
// Editing the prompt sends it verbatim (promptOverride) so the user can refine freely; an unedited
// prompt sends nothing and the action builds it server-side. On Apply it hands the data to the
// caller's own preview/edit surface (form fields / candidate list).
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
  action: (modelId: string, promptOverride?: PromptT) => Promise<GenerateResultT<T[]>>
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
  // The editable prompt. Seeded from previewPrompt on open; compared against that default to decide
  // whether to send a promptOverride (only when the user actually edited it).
  const [system, setSystem] = useState('')
  const [prompt, setPrompt] = useState('')

  // previewPrompt is pure (no DB / no LLM) — the default the textareas seed from and "Reset" restores.
  const defaults = previewPrompt(previewInput)
  const isEdited = system !== defaults.system || prompt !== defaults.prompt

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
    resetPrompt()
    setOpen(true)
  }

  function resetPrompt() {
    setSystem(defaults.system)
    setPrompt(defaults.prompt)
  }

  function generate() {
    setError(undefined)
    startGenerate(async () => {
      // Send the edited prompt only when changed; an unedited prompt lets the action build it
      // server-side (and re-fetch grounded source under its own RLS trust boundary).
      const outcome = await action(model, isEdited ? { system, prompt } : undefined)
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
        <DialogContent data-testid="generate-dialog" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Pick a model and edit the exact prompt before generating. The result is editable
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

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="generate-system">System prompt</Label>
                {isEdited && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="generate-prompt-reset"
                    onClick={resetPrompt}
                  >
                    Reset to default
                  </Button>
                )}
              </div>
              <Textarea
                id="generate-system"
                data-testid="generate-system"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                className="max-h-32 font-mono text-xs"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="generate-prompt">Prompt</Label>
              <Textarea
                id="generate-prompt"
                data-testid="generate-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="max-h-72 min-h-40 font-mono text-xs"
              />
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
