import { describe, expect, it } from 'vitest'

import { midpoint } from '@/features/subjects/midpoint'

// Guards the fractional-ordering math shared by the subject ToC + docs-view sidebar.
describe('midpoint', () => {
  it('averages two neighbors (drop in the middle)', () => {
    expect(midpoint(2, 4, 0)).toBe(3)
    expect(midpoint(1, 2, 0)).toBe(1.5)
  })

  it('halves the next position when dropped at the top (no prev)', () => {
    expect(midpoint(undefined, 4, 99)).toBe(2)
  })

  it('adds one above the last when dropped at the bottom (no next)', () => {
    expect(midpoint(8, undefined, 99)).toBe(9)
  })

  it('falls back to the original position when there are no neighbors', () => {
    expect(midpoint(undefined, undefined, 5)).toBe(5)
  })

  it('keeps shrinking the gap on repeated middle inserts', () => {
    const a = midpoint(1, 2, 0) // 1.5
    const b = midpoint(1, a, 0) // 1.25
    expect(a).toBe(1.5)
    expect(b).toBe(1.25)
    expect(b).toBeGreaterThan(1)
    expect(b).toBeLessThan(a)
  })
})
