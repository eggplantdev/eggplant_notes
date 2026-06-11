// The app's brand mark: the hand-drawn aubergine dot grid, coloured top→bottom along the brand neon
// ramp, with a soft glow and a −3° left lean. Self-contained — this is the single source for the
// logo (navbar, mobile menu, future favicon). The whole /logo experimentation surface that produced
// it (gallery, playground, shape generator, grid editor) was removed once this was locked in.

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

const DOT_R = 2.9 // dot radius in viewBox units
const GAP = 8 // cell pitch
const GLOW = 0.9 // 0..1 bloom intensity

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

export function BrandLogo({ className }: { className?: string }) {
  const rows = GRID.length
  const cols = GRID[0].length
  const dots: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (GRID[r][c] !== '1') continue
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={GAP * (c + 1)}
          cy={GAP * (r + 1)}
          r={DOT_R}
          fill={sampleRamp(r / (rows - 1))}
        />,
      )
    }
  }

  return (
    <svg
      viewBox={`0 0 ${(cols + 1) * GAP} ${(rows + 1) * GAP}`}
      className={`-rotate-2 ${className ?? ''}`}
      aria-hidden
    >
      {/* Glow is one blur pass over a cloned dot layer behind the sharp dots — not a per-dot filter,
          which would re-rasterise every dot on each paint. */}
      <defs>
        <filter id="brand-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={GLOW * DOT_R * 1.8} />
        </filter>
      </defs>
      <g filter="url(#brand-glow)" opacity={Math.min(1, 0.55 + GLOW * 0.45)}>
        {dots}
      </g>
      <g>{dots}</g>
    </svg>
  )
}
