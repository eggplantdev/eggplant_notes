import { FSRS_STATE_LABELS, MATURE_STABILITY_DAYS } from '@/features/memory-cards/constants'
import type { MemoryCardListItemT } from '@/features/memory-cards/types'

type PropsT = { cards: MemoryCardListItemT[] }

type TileT = { label: string; value: number }

function Tiles({ tiles }: { tiles: TileT[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">{t.value}</p>
          <p className="text-muted-foreground mt-1 text-xs">{t.label}</p>
        </div>
      ))}
    </div>
  )
}

// Aggregate view over the (subject-filtered) card set rendered on this page. Two distinct axes,
// kept in separate rows so their tiles aren't read as one total: the FSRS state mix
// (New/Learning/Review/Relearning) and the maturity split (stability ≥ MATURE_STABILITY_DAYS).
// Reflects the active filter, since `cards` is the post-filter list.
export function CardsOverview({ cards }: PropsT) {
  const stateCounts = [0, 0, 0, 0]
  let mature = 0
  for (const c of cards) {
    if (c.state >= 0 && c.state < stateCounts.length) stateCounts[c.state] += 1
    if (c.stability >= MATURE_STABILITY_DAYS) mature += 1
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          By state
        </p>
        <Tiles tiles={FSRS_STATE_LABELS.map((label, i) => ({ label, value: stateCounts[i] }))} />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          By maturity
        </p>
        <Tiles
          tiles={[
            { label: 'Mature', value: mature },
            { label: 'Young', value: cards.length - mature },
          ]}
        />
      </div>
    </div>
  )
}
