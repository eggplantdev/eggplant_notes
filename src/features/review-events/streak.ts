import { APP_TIME_ZONE, MS_PER_DAY, todayInZone, toISODate } from '@/lib/utils'
import type { ActivityDayT } from '@/types/activity'

// Consecutive days (in APP_TIME_ZONE) with ≥1 review, ending today — or yesterday when
// today has no review yet. Pure + synchronous, derived from the already-fetched
// getReviewActivity() series, so the dashboard composes both stats from a single activity
// read (no second DB query). Lives apart from queries.ts so it stays importable without the
// Supabase server client (and its env validation) — keeps it unit-testable in isolation.
export function getCurrentStreak(activity: ActivityDayT[]): number {
  const active = new Set(activity.filter((a) => a.count > 0).map((a) => a.date))
  let cursorMs = todayInZone(APP_TIME_ZONE).getTime()
  // Grace day: an un-reviewed today doesn't zero a live streak — count the run ending
  // yesterday until today is actually missed. Only today gets this grace; any earlier
  // gap still ends the streak.
  if (!active.has(toISODate(cursorMs))) cursorMs -= MS_PER_DAY
  let streak = 0
  while (active.has(toISODate(cursorMs))) {
    streak += 1
    cursorMs -= MS_PER_DAY
  }
  return streak
}

// Longest all-time run of consecutive active days in the series — the "best" against which
// the current streak is read. Same purity contract as getCurrentStreak; derived from the
// already-fetched activity, so no extra DB query. The series spans the ~400-day heatmap
// window, so "all-time" is bounded by that read (good enough for the dashboard).
export function getLongestStreak(activity: ActivityDayT[]): number {
  const days = activity
    .filter((a) => a.count > 0)
    .map((a) => Date.parse(`${a.date}T00:00:00.000Z`))
    .sort((a, b) => a - b)
  let longest = 0
  let run = 0
  let prevMs = NaN
  for (const ms of days) {
    run = ms === prevMs + MS_PER_DAY ? run + 1 : 1
    if (run > longest) longest = run
    prevMs = ms
  }
  return longest
}
