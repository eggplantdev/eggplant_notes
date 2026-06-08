'use client'

import { Sparkles } from 'lucide-react'
import { useState, useTransition, type ReactNode } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { toastMessage } from '@/components/toasts'
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
import { MutedText } from '@/components/ui/muted-text'
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
  children,
  canGenerate = true,
  modelFilter = 'text',
  resultNoun = 'item',
  applyHint,
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
  // Rendered at the top of the dialog body — used by the topic flow to put its source <textarea>
  // inside the dialog (the parent owns its state and feeds it back through previewInput/action).
  children?: ReactNode
  // Gates the Generate button. The topic flow sets it false while its in-dialog source is empty;
  // the import flow (source validated before open) leaves it at the default.
  canGenerate?: boolean
  // Scopes the model picker: 'file' restricts to vision/file-capable models (PDF import, Phase 8).
  modelFilter?: 'text' | 'file'
  // Singular noun for the success toast ("Generated 3 cards"). Caller-set so the toast is accurate.
  resultNoun?: string
  // Toasted on Apply, when the result lands in the caller's surface (fields / candidate list) that
  // the now-closed dialog was covering — the moment that was otherwise fully silent. Should point at
  // where the result went AND that nothing is saved until the caller's own Save/Add/Create/Import.
  applyHint?: string
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
  // The editable prompt as an OVERRIDE: `undefined` means "follow the live default", so the preview
  // tracks an in-dialog source (topic flow) as the user types; a value means the user edited and now
  // owns it. This is what's sent to the action — undefined lets the action build the prompt itself.
  const [override, setOverride] = useState<PromptT | undefined>(undefined)

  // previewPrompt is pure (no DB / no LLM). `shown` is the override if edited, else the live default.
  const defaults = previewPrompt(previewInput)
  const shown = override ?? defaults
  const isEdited = override !== undefined

  // Clear the stale trigger error as soon as the input becomes valid again (e.g. the user starts
  // typing — the parent re-renders us with fresh props). Adjust-during-render, not an effect; only
  // runs while an error is actually showing, and converges (the set makes the guard false).
  if (triggerError && !validate?.()) setTriggerError(undefined)

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
    setOverride(undefined)
    setOpen(true)
  }

  function generate() {
    setError(undefined)
    startGenerate(async () => {
      // `override` is undefined unless the user edited; an unedited prompt lets the action build it
      // server-side (and re-fetch grounded source under its own RLS trust boundary).
      const outcome = await action(model, override)
      if (outcome.success) {
        setResult({ data: outcome.data, debug: outcome.debug })
        const n = outcome.data.length
        // Toast renders in a body-level portal (above the dialog), so the outcome is visible even if
        // the user's attention has drifted off the dialog while the model worked.
        toastMessage(`Generated ${n} ${n === 1 ? resultNoun : `${resultNoun}s`}`, 'success')
      } else {
        setError(outcome.error)
        // Keep the inline FormError too — the toast is the attention-grabber, the inline line is the
        // persistent in-dialog record while the user retries.
        toastMessage(outcome.error, 'error')
      }
    })
  }

  function apply() {
    if (result) onResult(result.data)
    // Kill the silent moment: Apply closes the dialog and the result lands in a surface the user
    // wasn't watching. The hint says where it went and that nothing is saved yet.
    if (applyHint) toastMessage(applyHint, 'info')
    setOpen(false)
  }

  return (
    <>
      {/* relative + absolute error: the message must not grow this cell, or it re-centers the button row. */}
      <div className="relative grid justify-items-start">
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
        <FormError
          message={triggerError}
          className="bg-background absolute top-full left-0 z-10 mt-1 rounded-md px-1.5 py-0.5 whitespace-nowrap shadow-sm"
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-testid="generate-dialog"
          className="gradient-border ring-0 sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Pick a model and edit the exact prompt before generating. The result is editable
              before it is saved.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {children}
            <div className="grid gap-2">
              <Label htmlFor="generate-model">Model</Label>
              <ModelSelect
                value={model}
                onChange={setModel}
                defaultModelId={defaultModel}
                testId="generate-model"
                filter={modelFilter}
                modal
              />
              {modelFilter === 'file' && (
                <MutedText>
                  Only models that can read files (vision) are listed — a PDF needs one.
                </MutedText>
              )}
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
                    onClick={() => setOverride(undefined)}
                  >
                    Reset to default
                  </Button>
                )}
              </div>
              <Textarea
                id="generate-system"
                data-testid="generate-system"
                value={shown.system}
                onChange={(e) => setOverride({ ...shown, system: e.target.value })}
                className="max-h-32 font-mono text-xs"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="generate-prompt">Prompt</Label>
              <Textarea
                id="generate-prompt"
                data-testid="generate-prompt"
                value={shown.prompt}
                onChange={(e) => setOverride({ ...shown, prompt: e.target.value })}
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
                disabled={isGenerating || !canGenerate}
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
