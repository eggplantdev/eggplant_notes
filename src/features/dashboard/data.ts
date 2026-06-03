import { MS_PER_DAY } from '@/features/dashboard/constants'
import { toISODate } from '@/features/dashboard/utils'
import type { ActivityDayT, DashboardDataT } from '@/features/dashboard/types'

// ⚠️ UI-SHELL SPIKE (S-04 ahead of S-03). This returns DUMMY data so the dashboard UI can
// be built before the recall loop writes any `review_events`. The shapes are the real ones
// (see types.ts), so wiring is a body swap here — NOT a component change.
//
// TODO(S-03 data wiring): replace the body with real per-user queries —
//   activity:      group `review_events` by `reviewed_at::date`, count per day
//   dueToday:      count `topic_checks` whose `due_at` is on/before today
//   currentStreak: consecutive days ending today with ≥1 `review_event`
export async function getDashboardData(): Promise<DashboardDataT> {
  return {
    dueToday: 7,
    currentStreak: 12,
    activity: generateDummyActivity(365),
  }
}

// Deterministic pseudo-random per day index so the shell renders a stable pattern across
// reloads (and the e2e assertions stay stable). Not seeded by wall-clock randomness.
function generateDummyActivity(days: number): ActivityDayT[] {
  const out: ActivityDayT[] = []
  const todayMs = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const date = toISODate(todayMs - i * MS_PER_DAY)
    // cheap LCG-ish hash of the day index → 0..1, skewed toward empty/low days
    const h = ((i * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const count = h < 0.45 ? 0 : Math.max(0, Math.floor(h * 16) - 6)
    out.push({ date, count })
  }
  return out
}
