// Geometry for the brand mark — the hand-drawn aubergine dot grid, coloured top→bottom along the
// neon brand ramp. Single source shared by the on-screen <BrandLogo> and the favicon (app/icon.tsx),
// so reshaping the mark in one place updates both.

// '1' = a lit dot. Edit here to reshape the mark.
const GRID = [
  '0001000',
  '0011000',
  '0011100',
  '0111100',
  '0111110',
  '1111110',
  '1111111',
  '1111111',
  '0111110',
  '0011100',
]

// Neon brand ramp, head→tail (top→bottom of the mark): green → cyan → violet → fuchsia.
const RAMP = ['#10ffaa', '#00e5ff', '#a855f7', '#d946ef']

export const DOT_R = 2.9 // dot radius in viewBox units
const GAP = 8 // cell pitch

function hexToRgb(hex: string) {
  const int = parseInt(hex.slice(1), 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

// Piecewise-linear RGB sample of the ramp at t∈[0,1].
function sampleRamp(t: number) {
  const seg = Math.min(1, Math.max(0, t)) * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(seg))
  const f = seg - i
  const a = hexToRgb(RAMP[i])
  const b = hexToRgb(RAMP[i + 1])
  const m = (x: number, y: number) => Math.round(x + (y - x) * f)
  return `rgb(${m(a.r, b.r)}, ${m(a.g, b.g)}, ${m(a.b, b.b)})`
}

export type BrandDotT = { cx: number; cy: number; r: number; fill: string }

const rows = GRID.length
const cols = GRID[0].length

export const VIEWBOX = { width: (cols + 1) * GAP, height: (rows + 1) * GAP }

export function buildBrandDots(): BrandDotT[] {
  const dots: BrandDotT[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (GRID[r][c] !== '1') continue
      dots.push({
        cx: GAP * (c + 1),
        cy: GAP * (r + 1),
        r: DOT_R,
        fill: sampleRamp(r / (rows - 1)),
      })
    }
  }
  return dots
}

// Deterministic [0,1) hash for the entrance scatter: a given index always hashes the same way, with no
// per-call state. (A Math.random() scatter would differ between SSR and hydration.)
export function rand(seed: number) {
  const x = Math.sin(seed * 99.13) * 43758.5453
  return x - Math.floor(x)
}

// Where dot `i` starts before it flies in: pushed out from its final (cx,cy) along a hashed angle by a
// large hashed distance, so the grid begins as a loose cloud and converges inward.
//
// Rounded to whole viewBox units on purpose. This position is written straight into the SSR'd
// <circle cx/cy>, and Math.sin/Math.cos are NOT bit-identical between Node's V8 (server) and the
// browser's V8 (client) — the raw float diverges in its low digits and trips a React hydration
// mismatch. The dots are off-screen cloud points that immediately spring to rest, so integer-snapping
// the start position is visually invisible while making both engines serialize the same attribute.
export function scatter(i: number, cx: number, cy: number) {
  const angle = rand(i + 1) * Math.PI * 2
  const dist = (0.7 + rand(i * 2 + 5) * 0.9) * VIEWBOX.width
  return { x: Math.round(cx + Math.cos(angle) * dist), y: Math.round(cy + Math.sin(angle) * dist) }
}
