// UTC date helpers for the dashboard. All date math runs in UTC so the `YYYY-MM-DD` keys
// the heatmap joins on stay stable regardless of the runtime timezone. Feature-local (only
// the dashboard needs them) — promote to src/lib/utils only if a second feature does.

// Midnight-UTC epoch ms for a date, dropping any time-of-day.
export function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// `YYYY-MM-DD` for an epoch-ms instant.
export function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// `YYYY-MM-DD` for an instant as seen in a given IANA timezone. `en-CA` formats as
// ISO year-month-day, which is the join key both the activity buckets and the heatmap use.
export function isoDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// A Date at UTC-midnight of the *zone's* current calendar date. Returned this way so the
// UTC-based helpers (utcMidnight / toISODate, used by the heatmap + streak) read the right
// year/month/day — i.e. "today" follows the user's zone, not the UTC server clock.
export function todayInZone(timeZone: string): Date {
  return new Date(`${isoDateInZone(new Date(), timeZone)}T00:00:00.000Z`)
}
