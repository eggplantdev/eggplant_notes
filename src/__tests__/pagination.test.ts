import { describe, expect, it } from 'vitest'

import { DEFAULT_LIMIT, buildPaginationMeta, parsePagination } from '@/lib/utils/pagination'

// Guards the page-math the three list reads + the footer all thread through.
describe('parsePagination', () => {
  it('defaults to page 1 + DEFAULT_LIMIT when nothing is in the URL', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT })
  })

  it('reads a valid page number', () => {
    expect(parsePagination({ page: '3' })).toEqual({ page: 3, limit: DEFAULT_LIMIT })
  })

  it('clamps page < 1 (and zero/negative/non-numeric) up to 1', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1)
    expect(parsePagination({ page: '-5' }).page).toBe(1)
    expect(parsePagination({ page: 'abc' }).page).toBe(1)
  })

  it('floors a fractional page', () => {
    expect(parsePagination({ page: '2.7' }).page).toBe(2)
  })

  it('ignores any ?limit — the page size is fixed (no selector), so it always resolves to default', () => {
    expect(parsePagination({ limit: '7' }).limit).toBe(DEFAULT_LIMIT)
    expect(parsePagination({ limit: '50' }).limit).toBe(DEFAULT_LIMIT)
  })
})

describe('buildPaginationMeta', () => {
  it('computes totalPages by ceil(total / limit)', () => {
    expect(buildPaginationMeta(50, 1, 24)).toEqual({
      currentPage: 1,
      totalPages: 3,
      totalDocs: 50,
      limit: 24,
    })
  })

  it('a full single page is exactly 1 page', () => {
    expect(buildPaginationMeta(24, 1, 24).totalPages).toBe(1)
  })

  it('floors totalPages to at least 1 even for an empty result', () => {
    expect(buildPaginationMeta(0, 1, 24).totalPages).toBe(1)
  })

  it('passes currentPage through (incl. an out-of-range page — no clamping here)', () => {
    expect(buildPaginationMeta(30, 99, 24).currentPage).toBe(99)
  })
})
