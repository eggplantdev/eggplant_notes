import { APP_TIME_ZONE, MS_PER_DAY, todayInZone, toISODate } from '@/lib/utils'
import type { ActivityDayT } from '@/types/activity'

// Consecutive days (APP_TIME_ZONE) that met the goal, ending today (or yesterday if today hasn't
// hit it yet). A day qualifies when count ≥ goal; count is distinct cards (same unit as the goal
// bar), so "goal hit today" and "streak counts today" always agree.
export function getCurrentStreak(activity: ActivityDayT[], goal: number): number {
  const met = new Set(activity.filter((a) => a.count >= goal).map((a) => a.date))
  let cursorMs = todayInZone(APP_TIME_ZONE).getTime()
  // Grace day: a goal-short today doesn't zero a live streak (count the run ending yesterday). Only today gets grace.
  if (!met.has(toISODate(cursorMs))) cursorMs -= MS_PER_DAY
  let streak = 0
  while (met.has(toISODate(cursorMs))) {
    streak += 1
    cursorMs -= MS_PER_DAY
  }
  return streak
}
