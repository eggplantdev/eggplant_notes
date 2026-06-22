import { describe, expect, it } from 'vitest'

import { buildBrandDots, scatter } from '@/components/brand/brand-mark-dots'

// Regression guard for a hydration mismatch: the scatter start positions are written into the SSR'd
// <circle cx/cy>. scatter() uses Math.sin/cos, which are NOT bit-identical between Node's V8 (server)
// and the browser's V8 (client) — the raw float diverges in its low digits and trips a React hydration
// error. Quantizing the positions to whole viewBox units makes both engines serialize the same string.
describe('scatter (brand logo entrance)', () => {
  it('returns integer coordinates for every dot so SSR and client markup match', () => {
    buildBrandDots().forEach((d, i) => {
      const p = scatter(i, d.cx, d.cy)
      expect(Number.isInteger(p.x)).toBe(true)
      expect(Number.isInteger(p.y)).toBe(true)
    })
  })
})
