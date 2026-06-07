import type { ReviewDayCountT } from '@/features/review-events/types'
import { APP_TIME_ZONE, isoDateInZone, MS_PER_DAY } from '@/lib/utils'
import type { ActivityDayT } from '@/types/activity'

// Pure derivations off the review_day_counts RPC rows (already bucketed to APP_TIME_ZONE days in
// SQL). The day-bucketing that used to live in countDistinctReviewedOn / countReviewsInWeek now
// happens in Postgres; these only slice the small per-day result.

// The two day-keys the tallies below are sliced against: today and the trailing-week start
// (today − 6d), both in APP_TIME_ZONE. Shared by the dashboard and the rate-action goal check so
// the "today"/"this week" boundaries can't drift between them.
export function reviewWindowKeys(): { todayStr: string; weekStartStr: string } {
  return {
    todayStr: isoDateInZone(new Date(), APP_TIME_ZONE),
    weekStartStr: isoDateInZone(new Date(Date.now() - 6 * MS_PER_DAY), APP_TIME_ZONE),
  }
}

// Heatmap/streak shape: distinct cards per day.
export function toActivity(rows: ReviewDayCountT[]): ActivityDayT[] {
  return rows.map((r) => ({ date: r.date, count: r.distinctCards }))
}

// Distinct cards reviewed on `todayStr` (YYYY-MM-DD). Missing day → 0.
export function reviewedTodayCount(rows: ReviewDayCountT[], todayStr: string): number {
  return rows.find((r) => r.date === todayStr)?.distinctCards ?? 0
}

// Total review EVENTS (re-reviews counted) on or after `weekStartStr` (YYYY-MM-DD).
export function reviewsThisWeekCount(rows: ReviewDayCountT[], weekStartStr: string): number {
  return rows.reduce((sum, r) => (r.date >= weekStartStr ? sum + r.totalEvents : sum), 0)
}
