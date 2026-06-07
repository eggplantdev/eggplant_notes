export type OpenRouterModelT = { id: string; label: string }

// Curated short list (curate-don't-enumerate — same call as S-13's Shiki langs). All are cheap and
// good at structured extraction. BYOK bills the user's own key, so cost/quality is ultimately their
// call; this just keeps the picker sane versus OpenRouter's 300+ models. A live /models fetch is
// deliberately deferred (only if a user needs an off-list model).
export const OPENROUTER_MODELS: OpenRouterModelT[] = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini — cheap, fast' },
  { id: 'openai/gpt-4o', label: 'GPT-4o — stronger' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku — cheap' },
  { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet — stronger' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash — cheap' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
]

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini'
