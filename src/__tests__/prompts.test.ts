import { describe, expect, it } from 'vitest'

import {
  buildCardsPrompt,
  buildNotesFilePrompt,
  buildNotesPrompt,
} from '@/features/openrouter/build-prompt'
import { previewPrompt } from '@/features/openrouter/preview-prompt'
import { promptOverrideSchema } from '@/features/openrouter/prompt-schemas'

// The dialog previews `previewPrompt(...)` while the actions send `build*Prompt(...)`. The contract
// is "what you see is what gets sent" — so previewPrompt must route to the SAME builders. These
// assert that equivalence per variant; if a builder and the preview ever diverge, this fails.
describe('previewPrompt mirrors the builder each action sends', () => {
  it('cards → buildCardsPrompt', () => {
    const material = 'Note title: T\n\nbody'
    expect(previewPrompt({ task: 'cards', material })).toEqual(buildCardsPrompt(material))
  })

  it('notes from text → buildNotesPrompt({ text })', () => {
    const text = 'long source prose'
    expect(previewPrompt({ task: 'notes', text })).toEqual(buildNotesPrompt({ text }))
  })

  it('notes from topic → buildNotesPrompt({ topic })', () => {
    const topic = 'closures'
    expect(previewPrompt({ task: 'notes', topic })).toEqual(buildNotesPrompt({ topic }))
  })

  it('notes from file → buildNotesFilePrompt', () => {
    expect(previewPrompt({ task: 'notes', file: true })).toEqual(buildNotesFilePrompt())
  })
})

describe('note prompt builders', () => {
  it('text and topic paths use different system prompts and embed their source', () => {
    const fromText = buildNotesPrompt({ text: 'SRC' })
    const fromTopic = buildNotesPrompt({ topic: 'graphs' })
    expect(fromText.system).not.toBe(fromTopic.system)
    expect(fromText.prompt).toContain('SRC')
    expect(fromTopic.prompt).toContain('graphs')
  })

  it('file path reuses the decompose system (only the instruction differs)', () => {
    // The PDF-vision path is the decompose intent with the source attached as a file part, so it
    // must share the text-decompose system prompt rather than fork a near-duplicate.
    expect(buildNotesFilePrompt().system).toBe(buildNotesPrompt({ text: 'x' }).system)
  })
})

describe('promptOverrideSchema', () => {
  it('accepts a well-formed edited prompt and trims both halves', () => {
    const parsed = promptOverrideSchema.safeParse({ system: '  sys  ', prompt: '  ask  ' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data).toEqual({ system: 'sys', prompt: 'ask' })
  })

  it('rejects an empty or whitespace-only half', () => {
    expect(promptOverrideSchema.safeParse({ system: 's', prompt: '' }).success).toBe(false)
    expect(promptOverrideSchema.safeParse({ system: '   ', prompt: 'p' }).success).toBe(false)
  })

  it('rejects a pathologically large blob (over the char cap)', () => {
    const huge = 'x'.repeat(100_001)
    expect(promptOverrideSchema.safeParse({ system: huge, prompt: 'p' }).success).toBe(false)
  })
})
