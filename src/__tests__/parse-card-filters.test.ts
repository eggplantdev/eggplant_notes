import { describe, expect, it } from 'vitest'

import { parseCardFilters } from '@/features/memory-cards/utils'

// Guards the URL-filter sanitization the /memory-cards listing threads into its query predicates.
// The oracle is the validation contract (drop junk, keep only legal states/buckets), not the impl.
describe('parseCardFilters', () => {
  it('returns empty arrays when nothing is in the URL', () => {
    expect(parseCardFilters({})).toEqual({ states: [], maturity: [] })
  })

  it('does not coerce an empty string to state 0', () => {
    expect(parseCardFilters({ state: '' }).states).toEqual([])
  })

  it('keeps valid FSRS state indices', () => {
    expect(parseCardFilters({ state: '0,2,3' }).states).toEqual([0, 2, 3])
  })

  it('drops non-integer, out-of-range, and non-numeric state junk', () => {
    expect(parseCardFilters({ state: '2,abc,9,2.5,-1' }).states).toEqual([2])
  })

  it('keeps known maturity buckets', () => {
    expect(parseCardFilters({ maturity: 'mature,young' }).maturity).toEqual(['mature', 'young'])
  })

  it('drops unknown maturity values', () => {
    expect(parseCardFilters({ maturity: 'mature,old,xyz' }).maturity).toEqual(['mature'])
  })

  it('parses state and maturity together', () => {
    expect(parseCardFilters({ state: '2', maturity: 'mature' })).toEqual({
      states: [2],
      maturity: ['mature'],
    })
  })
})
