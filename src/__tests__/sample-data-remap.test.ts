import { describe, expect, it } from 'vitest'

import { remapSampleData } from '@/features/sample-data/remap'
import type { SampleDataT } from '@/features/sample-data/types'

const USER = 'user-123'
// Deterministic stand-in for the action's memoized crypto.randomUUID: ref -> "id:<ref>".
const idFor = (ref: string) => `id:${ref}`

const fixture: SampleDataT = {
  subjects: [{ ref: 's1', title: 'Sub', description: 'desc' }],
  notes: [
    { ref: 'n1', subjectRef: 's1', title: 'N1', content: '# n1', position: 1 },
    { ref: 'n2', subjectRef: null, title: 'N2', content: '# n2', position: 2 },
  ],
  cards: [
    { noteRef: 'n1', prompt: 'p1', example: 'e1' },
    { noteRef: 'n2', prompt: 'p2', example: null },
  ],
}

describe('remapSampleData', () => {
  it('assigns ids per ref and rewires child FKs to the new parent ids', () => {
    const { subjects, notes, cards } = remapSampleData(fixture, USER, idFor)
    expect(subjects[0].id).toBe('id:s1')
    // note → subject FK resolves to the subject's new id, or null when unparented
    expect(notes[0].subject_id).toBe('id:s1')
    expect(notes[1].subject_id).toBeNull()
    // card → note FK resolves to each note's new id
    expect(cards[0].note_id).toBe('id:n1')
    expect(cards[1].note_id).toBe('id:n2')
  })

  it('preserves position and sets user_id + is_seeded on every row', () => {
    const { subjects, notes, cards } = remapSampleData(fixture, USER, idFor)
    expect(notes.map((n) => n.position)).toEqual([1, 2])
    for (const row of [...subjects, ...notes, ...cards]) {
      expect(row.user_id).toBe(USER)
      expect(row.is_seeded).toBe(true)
    }
  })

  it('carries content and nullable fields through unchanged', () => {
    const { notes, cards } = remapSampleData(fixture, USER, idFor)
    expect(notes[0].content).toBe('# n1')
    expect(cards[0].example).toBe('e1')
    expect(cards[1].example).toBeNull()
  })

  it('handles an empty fixture', () => {
    const empty: SampleDataT = { subjects: [], notes: [], cards: [] }
    expect(remapSampleData(empty, USER, idFor)).toEqual({ subjects: [], notes: [], cards: [] })
  })
})
