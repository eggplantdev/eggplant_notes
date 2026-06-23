import type { OpenRouterModelT } from '@/features/openrouter/types'

// Hard ceiling for a single generation call. Past this the abort fires and the dialog surfaces a
// timeout message instead of spinning "Generating…" forever on a hung model.
export const GENERATION_TIMEOUT_MS = 60_000

// Floor for the effective prompt the dialog will send. The dialog OPENS freely (no source gate), but
// the user can clear the Prompt textarea — this blocks Generate on an empty/trivial prompt so we
// never fire a no-op generation.
export const MIN_GENERATION_PROMPT_CHARS = 10

// Curated short list. Not a UI group (the picker's top group is the user's per-user "Pinned" set);
// it seeds two things: the offline catalog FALLBACK (RECOMMENDED_FALLBACK below) and a freshly
// connected account's DB-default favorites (mirrored in migration 20260608100741 — keep aligned).
// All are cheap and good at structured extraction.
export const RECOMMENDED_MODELS: { id: string; label: string }[] = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini — cheap, fast' },
  { id: 'openai/gpt-4o', label: 'GPT-4o — stronger' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku — cheap' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5 — stronger' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash — cheap' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
]

// The curated set widened to the full picker shape with unknown (0) pricing and text-only modality.
// Shared by the offline catalog FALLBACK (catalog.ts) and the picker's pre-fetch SEED (model-select.tsx)
// so the two can't drift. Read-only; neither consumer mutates it.
export const RECOMMENDED_FALLBACK: OpenRouterModelT[] = RECOMMENDED_MODELS.map((m) => ({
  ...m,
  inputPrice: 0,
  outputPrice: 0,
  inputModalities: ['text'],
}))

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini'

// Default for the PDF/vision import surface (Phase 8): a cheap, file-capable, dated id (never a
// `*-latest` alias). Gemini Flash reads PDFs well at low cost; the picker still lets the user switch.
export const DEFAULT_OPENROUTER_FILE_MODEL = 'google/gemini-2.5-flash'

// The three system prompts a user can override (editable-system-prompts). MUST match the
// prompt_key CHECK constraint in the user_prompts migration. Single source: PromptKeyT and the
// userPromptSchema enum both derive from this array.
export const PROMPT_KEYS = ['cards', 'notes_decompose', 'notes_topic'] as const
export type PromptKeyT = (typeof PROMPT_KEYS)[number]
