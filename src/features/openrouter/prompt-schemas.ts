import { z } from 'zod'

import { PROMPT_KEYS } from '@/features/openrouter/constants'

// Input validation for the editable prompt (editable-system-prompts). Distinct from ai-schemas.ts,
// which constrains the generation OUTPUT — these only sanity-check what the user types.

// Cap on a user-edited prompt. The auto-built prompt embeds the source text (notes decompose allows
// up to 50k chars) plus instructions, so the ceiling is generous — it only guards against pathological
// payloads, not normal refinement.
const MAX_PROMPT_CHARS = 100_000

// Validates the dialog's editable prompt before it reaches `generateObject`: both halves must be
// non-empty after trim and within the cap.
export const promptOverrideSchema = z.object({
  system: z.string().trim().min(1, 'System prompt is empty').max(MAX_PROMPT_CHARS),
  prompt: z.string().trim().min(1, 'Prompt is empty').max(MAX_PROMPT_CHARS),
})

// Validates a Save-prompt mutation (editable-system-prompts): which prompt to override + the
// replacement system text. Only the system half is persisted — the user-message half stays a
// per-generation override (see generate-dialog).
export const userPromptSchema = z.object({
  promptKey: z.enum(PROMPT_KEYS),
  system: z.string().trim().min(1, 'Prompt is empty').max(MAX_PROMPT_CHARS),
})
