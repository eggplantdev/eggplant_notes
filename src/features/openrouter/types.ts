// Token usage off the AI SDK v6 `generateObject` result. Each field can be undefined (the SDK types
// them as `number | undefined`), so the UI/logger must tolerate missing counts.
export type UsageT = {
  inputTokens: number | undefined
  outputTokens: number | undefined
  totalTokens: number | undefined
}

// Always-on generation debug: the exact prompt sent + the token usage. Surfaced in the generate
// dialog and written to the local ai-debug log. Not gated — present on every successful call.
export type GenerateDebugT = { system: string; prompt: string; model: string; usage: UsageT }

// Distinct from ActionResultT — carries a typed data payload.
export type GenerateResultT<T> =
  | { success: true; data: T; debug: GenerateDebugT }
  | { success: false; error: string }

// A model in the picker: the live `/models` catalog normalizes to this; the curated recommended set
// is the same shape sans live pricing (filled at 0). `inputModalities` drives the file/vision filter.
export type OpenRouterModelT = {
  id: string
  label: string
  // Per-token USD (as OpenRouter bills). Multiply by 1e6 for the conventional "/1M tokens" display.
  inputPrice: number
  outputPrice: number
  inputModalities: string[]
}

export type ModelSortT = 'name' | 'input' | 'output'
export type SortDirT = 'asc' | 'desc'

// The two halves of one AI generation call: a static `system` steer + a `prompt` user message that
// carries the dynamic material. Built by build-prompt.ts, previewed by preview-prompt.ts, and sent by
// the generate actions — all from the same builders so the shown prompt can't drift from the sent one.
export type PromptT = { system: string; prompt: string }
