import { describe, expect, it } from 'vitest'

import { buildHeatmapMatrix, countToLevel } from '@/features/dashboard/build-heatmap-matrix'

describe('countToLevel', () => {
  it('maps counts to the five intensity buckets', () => {
    expect(countToLevel(0)).toBe(0)
    expect(countToLevel(1)).toBe(1)
    expect(countToLevel(5)).toBe(1)
    expect(countToLevel(6)).toBe(2)
    expect(countToLevel(10)).toBe(2)
    expect(countToLevel(11)).toBe(3)
    expect(countToLevel(15)).toBe(3)
    expect(countToLevel(16)).toBe(4)
    expect(countToLevel(99)).toBe(4)
  })

  it('treats negative counts as empty', () => {
    expect(countToLevel(-1)).toBe(0)
  })
})

describe('buildHeatmapMatrix', () => {
  // Wednesday 2026-06-03 (UTC). getUTCDay() === 3.
  const today = new Date('2026-06-03T00:00:00.000Z')

  it('produces `weeks` columns of 7 weekday-indexed cells', () => {
    const cols = buildHeatmapMatrix([], { today, weeks: 4 })
    expect(cols).toHaveLength(4)
    for (const col of cols) expect(col.cells).toHaveLength(7)
  })

  it('places a dated cell at the correct weekday row', () => {
    // 2026-06-01 is a Monday (weekday 1).
    const cols = buildHeatmapMatrix([{ date: '2026-06-01', count: 4 }], { today, weeks: 2 })
    const lastColumn = cols[cols.length - 1]
    const monday = lastColumn.cells[1]
    expect(monday.date).toBe('2026-06-01')
    expect(monday.count).toBe(4)
    expect(monday.level).toBe(1)
  })

  it('pads days after today as null cells', () => {
    const cols = buildHeatmapMatrix([], { today, weeks: 1 })
    const lastColumn = cols[0]
    // today is Wednesday (3): Thu/Fri/Sat are in the future → padding.
    expect(lastColumn.cells[3].date).toBe('2026-06-03')
    expect(lastColumn.cells[4].date).toBeNull()
    expect(lastColumn.cells[5].date).toBeNull()
    expect(lastColumn.cells[6].date).toBeNull()
  })

  it('defaults undated in-range days to count 0 / level 0', () => {
    const cols = buildHeatmapMatrix([], { today, weeks: 1 })
    const sunday = cols[0].cells[0]
    expect(sunday.date).toBe('2026-05-31')
    expect(sunday.count).toBe(0)
    expect(sunday.level).toBe(0)
  })

  it('labels a column only when its month changes', () => {
    // weeks=8 ending Wed 2026-06-03 → columns keyed by Sunday span Apr 12 … May 31.
    const cols = buildHeatmapMatrix([], { today, weeks: 8 })
    const labels = cols.map((c) => c.monthLabel)
    expect(labels[0]).toBe('Apr') // first column always labels its month
    expect(labels.filter((l) => l === 'Apr').length).toBe(1)
    expect(labels.filter((l) => l === 'May').length).toBe(1)
    expect(labels.filter(Boolean).length).toBe(2)
  })
})
