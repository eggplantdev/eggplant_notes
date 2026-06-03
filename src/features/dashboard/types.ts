// Dashboard data contract. These shapes match what the real queries will return
// post-S-03 (the recall loop writes `review_events`); the UI shell fills them with
// dummy data so the presentation layer can be built ahead of that wiring. Keeping the
// types real means the later swap is a body change in `data.ts`, not a UI rewrite.

// One calendar day of review activity. `date` is an ISO `YYYY-MM-DD` string (UTC).
export type ActivityDay = { date: string; count: number }

export type DashboardData = {
  dueToday: number
  currentStreak: number
  activity: ActivityDay[]
}
