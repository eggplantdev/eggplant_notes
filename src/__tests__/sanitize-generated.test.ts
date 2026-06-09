import { describe, expect, it } from 'vitest'

import {
  keepCompleteCards,
  keepCompleteNotes,
} from '@/features/openrouter/utils/sanitize-generated'

// Guards the runtime emptiness contract: the schema accepts `""`, so one blank item the model emits
// must be dropped before it reaches the preview/save path — without poisoning the rest of the batch.
describe('keepCompleteCards', () => {
  it('keeps complete cards', () => {
    const cards = [{ prompt: 'q', example: 'a' }]
    expect(keepCompleteCards(cards)).toEqual(cards)
  })

  it('drops a card with a blank field, keeps the rest', () => {
    const cards = [
      { prompt: 'q1', example: 'a1' },
      { prompt: '', example: 'a2' },
      { prompt: 'q3', example: '' },
    ]
    expect(keepCompleteCards(cards)).toEqual([{ prompt: 'q1', example: 'a1' }])
  })

  it('treats whitespace-only fields as blank', () => {
    expect(keepCompleteCards([{ prompt: '   ', example: '\n\t' }])).toEqual([])
  })

  it('empty in → empty out', () => {
    expect(keepCompleteCards([])).toEqual([])
  })
})

describe('keepCompleteNotes', () => {
  it('keeps complete notes', () => {
    const notes = [{ title: 't', content: 'c' }]
    expect(keepCompleteNotes(notes)).toEqual(notes)
  })

  it('drops a note with a blank field, keeps the rest', () => {
    const notes = [
      { title: 't1', content: 'c1' },
      { title: '', content: 'c2' },
      { title: 't3', content: '  ' },
    ]
    expect(keepCompleteNotes(notes)).toEqual([{ title: 't1', content: 'c1' }])
  })

  it('empty in → empty out', () => {
    expect(keepCompleteNotes([])).toEqual([])
  })
})
