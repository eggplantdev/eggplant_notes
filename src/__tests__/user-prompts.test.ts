import { describe, expect, it } from 'vitest'

import {
  BUILTIN_SYSTEM,
  isBuiltinSystem,
  resolveSystemPrompts,
} from '@/features/openrouter/system-prompts'
import { promptKeyFromPreviewInput } from '@/features/openrouter/preview-prompt'

// The pure logic behind editable-system-prompts. The DB read (getResolvedSystemPrompts) and the
// server actions are exercised via the Phase 4 manual/E2E pass; here we lock the decisions they lean on.

describe('resolveSystemPrompts', () => {
  it('returns every built-in default when there are no override rows', () => {
    expect(resolveSystemPrompts([])).toEqual(BUILTIN_SYSTEM)
  })

  it('overlays only the keys that have a saved row, leaving the rest built-in', () => {
    const resolved = resolveSystemPrompts([{ prompt_key: 'cards', system: 'my cards prompt' }])
    expect(resolved.cards).toBe('my cards prompt')
    expect(resolved.notes_decompose).toBe(BUILTIN_SYSTEM.notes_decompose)
    expect(resolved.notes_topic).toBe(BUILTIN_SYSTEM.notes_topic)
  })

  it('ignores a stray prompt_key so it cannot widen the map', () => {
    const resolved = resolveSystemPrompts([{ prompt_key: 'bogus', system: 'x' }])
    expect(resolved).toEqual(BUILTIN_SYSTEM)
    expect('bogus' in resolved).toBe(false)
  })
})

describe('isBuiltinSystem (drives Save delete-if-default)', () => {
  it('is true when the text equals the built-in, including surrounding whitespace', () => {
    expect(isBuiltinSystem('cards', BUILTIN_SYSTEM.cards)).toBe(true)
    expect(isBuiltinSystem('cards', `  ${BUILTIN_SYSTEM.cards}  `)).toBe(true)
  })

  it('is false for an edited prompt and is per-key', () => {
    expect(isBuiltinSystem('cards', `${BUILTIN_SYSTEM.cards} Make exactly 1 card.`)).toBe(false)
    // The notes_topic default is not the cards default → comparing across keys is false.
    expect(isBuiltinSystem('cards', BUILTIN_SYSTEM.notes_topic)).toBe(false)
  })
})

describe('promptKeyFromPreviewInput', () => {
  it('maps each previewInput shape to its prompt key', () => {
    expect(promptKeyFromPreviewInput({ task: 'cards', material: 'm' })).toBe('cards')
    expect(promptKeyFromPreviewInput({ task: 'notes', topic: 't' })).toBe('notes_topic')
    expect(promptKeyFromPreviewInput({ task: 'notes', text: 'x' })).toBe('notes_decompose')
    expect(promptKeyFromPreviewInput({ task: 'notes', file: true })).toBe('notes_decompose')
  })
})
