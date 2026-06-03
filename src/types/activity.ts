// One calendar day of review activity. `date` is an ISO `YYYY-MM-DD` string (bucketed in
// APP_TIME_ZONE). Cross-feature shared type — produced by features/review-events, consumed by
// features/dashboard (matrix builder, data seam). Promoted from features/dashboard/types on the
// 2nd consumer, per the feature-first rule.
export type ActivityDayT = { date: string; count: number }
