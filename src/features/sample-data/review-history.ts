import type { TablesInsert } from '@/lib/supabase/types'

// The in-app sample-data loader seeds subjects/notes/cards but historically inserted ZERO
// review_events — so a freshly-seeded account (the only path real users hit; supabase/seed.sql is
// dev-only) showed an empty dashboard: blank "Review activity" heatmap, 0 streak, 0 reviews/30d, no
// retention. This builds ~1 year of synthetic history so those panels read as a lived-in account,
// mirroring what seed.sql does for the local test@gmail.com bed.

const HISTORY_DAYS = 365
// Recent days kept dense and goal-hitting so CURRENT STREAK reads non-zero. Each such day reviews
// >= DAILY_GOAL DISTINCT cards (the streak metric is distinct cards/day vs the goal, default 5).
const RECENT_STREAK_DAYS = 12
const DAILY_GOAL = 5

// Deterministic 0..1 from an integer seed — stable, reproducible history (testable) without a PRNG
// dep. Not cryptographic; only needs to look irregular across days.
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// rating is the locked 0-5 quality grade; retention (30d) counts >= 3. Skew to Good/Easy with a
// realistic minority of Again/Hard.
function ratingFor(seed: number): number {
  const roll = rand(seed)
  if (roll < 0.08) return 1
  if (roll < 0.22) return 2
  if (roll < 0.8) return 3
  return 4
}

// Pure: card ids + the owner + "now" → insert-ready review_events. `now` is injected so the spread is
// deterministic in tests. Cards are picked round-robin within a day, so each day's reviews hit
// DISTINCT cards (up to the deck size) — what the streak metric requires.
export function generateReviewHistory(
  cardIds: string[],
  userId: string,
  now: Date,
): TablesInsert<'review_events'>[] {
  if (cardIds.length === 0) return []

  const events: TablesInsert<'review_events'>[] = []
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  let cardCursor = 0
  for (let d = 0; d < HISTORY_DAYS; d++) {
    let count: number
    if (d < RECENT_STREAK_DAYS) {
      count = DAILY_GOAL + Math.floor(rand(d + 1) * 8) // 5..12 — keeps the streak alive
    } else {
      const roll = rand(d + 100)
      if (roll < 0.3)
        count = 0 // ~30% rest days → a believable, non-uniform heatmap
      else if (roll < 0.7)
        count = 1 + Math.floor(rand(d + 200) * 5) // light days
      else count = 6 + Math.floor(rand(d + 300) * 12) // busier days
    }
    count = Math.min(count, cardIds.length)

    for (let i = 0; i < count; i++) {
      const memoryCardId = cardIds[cardCursor % cardIds.length]
      cardCursor++
      const reviewedAt = new Date(startOfToday)
      reviewedAt.setDate(reviewedAt.getDate() - d)
      reviewedAt.setHours(12, Math.floor(rand(d * 31 + i) * 60), 0, 0)
      events.push({
        user_id: userId,
        memory_card_id: memoryCardId,
        rating: ratingFor(d * 17 + i * 3 + 7),
        reviewed_at: reviewedAt.toISOString(),
      })
    }
  }

  return events
}
