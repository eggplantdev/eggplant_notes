import type { PromptKeyT } from '@/features/openrouter/constants'

// The system-prompt text + the override-resolution semantics (editable-system-prompts). System
// prompts are static constants (kept constant for prompt-cache friendliness — S01E02); the dynamic
// material goes in the user message (build-prompt.ts). This is the one file to edit when refining the
// built-in prompt wording.

export const CARDS_SYSTEM = [
  'You generate spaced-repetition recall cards for a learner.',
  'Each card has a "prompt" (a question or cue) and an "example" (the answer or a worked example).',
  'Base every card ONLY on the material provided — never invent facts beyond it.',
  'Produce a single focused card by default; only generate more when the material clearly covers several distinct points.',
  'Make each prompt test something genuinely worth memorising — a concept, distinction, or "why" — not a trivial or throwaway fact.',
  'Each card links to a note the learner can open, so the prompt can be a sharp recall cue rather than fully self-contained.',
  'The "example" is rendered as markdown: write a short prose answer, and whenever the material is about code, include a concrete code example that illustrates it.',
  'ALWAYS put code in a fenced block tagged with its language (```ts, ```rust, ```python, …) — unfenced code renders as one flat, unhighlighted line.',
  'Keep prompts answerable and examples concise.',
].join(' ')

export const NOTES_DECOMPOSE_SYSTEM = [
  'You split source material into multiple focused study notes.',
  'Each note has a "title" and markdown "content".',
  'The title is stored and shown separately — never repeat it as a heading inside "content".',
  'Identify the distinct topics and produce one note per topic — prefer several notes over one.',
  'Base every note ONLY on the provided text; do not invent material.',
  'Write each note to be fully self-contained for a cold reader who cannot see the source or this conversation — inline the concepts, definitions, and the "why", and never reference "the text above" or "as mentioned".',
  '"content" is rendered as markdown: whenever the material is about code, include a concrete code example, and ALWAYS put code in a fenced block tagged with its language (```ts, ```rust, ```python, …) — unfenced code renders as one flat, unhighlighted line.',
  'Keep every note high-signal — include what is worth studying and cut filler that adds length without value.',
].join(' ')

export const NOTES_TOPIC_SYSTEM = [
  'You write a single focused study note on the given topic.',
  'The note has a "title" and clear, well-structured markdown "content".',
  'The title is stored and shown separately — never repeat it as a heading inside "content".',
  'Write it to be fully self-contained for a cold reader who cannot see this conversation — inline the concepts, definitions, and the "why".',
  '"content" is rendered as markdown: whenever the topic is about code, include a concrete code example, and ALWAYS put code in a fenced block tagged with its language (```ts, ```rust, ```python, …) — unfenced code renders as one flat, unhighlighted line.',
  'Keep it high-signal — no filler that adds length without value.',
].join(' ')

// The built-in default per key — the fallback when a user has no override row (resolver returns
// these) and the equality target for the Save "delete-if-default" branch (isBuiltinSystem).
export const BUILTIN_SYSTEM: Record<PromptKeyT, string> = {
  cards: CARDS_SYSTEM,
  notes_decompose: NOTES_DECOMPOSE_SYSTEM,
  notes_topic: NOTES_TOPIC_SYSTEM,
}

// Drives the Save "delete-if-default" branch: saving the built-in text verbatim means "no override",
// so the action deletes the row instead of forking the user onto a frozen copy of the default.
// Trim both sides — the schema trims input, and the constants are already trim-clean.
export function isBuiltinSystem(promptKey: PromptKeyT, system: string): boolean {
  return system.trim() === BUILTIN_SYSTEM[promptKey]
}

// Pure reduce behind getResolvedSystemPrompts: overlay each saved row onto the built-in defaults.
// Unknown keys are ignored so a stray row can't widen the map. Kept pure (no DB) so it's unit-testable.
export function resolveSystemPrompts(
  rows: ReadonlyArray<{ prompt_key: string; system: string }>,
): Record<PromptKeyT, string> {
  const resolved = { ...BUILTIN_SYSTEM }
  for (const row of rows) {
    if (row.prompt_key in resolved) resolved[row.prompt_key as PromptKeyT] = row.system
  }
  return resolved
}
