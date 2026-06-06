// All day math runs in UTC so the `YYYY-MM-DD` keys the heatmap + streak join on stay stable
// regardless of the runtime timezone (Vercel functions run in UTC).

export const MS_PER_DAY = 86_400_000

// Single fixed calendar zone for bucketing "today": Vercel runs in UTC, so a naive `new Date()`
// would bucket a late-night local review into the next UTC day — this keeps "today" on the clock.
export const APP_TIME_ZONE = 'Europe/Warsaw'

export function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// `Intl.DateTimeFormat` construction loads ICU data (the costly part); these helpers run per-row
// on list/heatmap renders, so memoize one formatter per timezone instead of rebuilding each call.
const zoneDateFormatters = new Map<string, Intl.DateTimeFormat>()
function zoneDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zoneDateFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    zoneDateFormatters.set(timeZone, formatter)
  }
  return formatter
}

// `en-CA` formats as ISO year-month-day, the join key both the activity buckets and heatmap use.
export function isoDateInZone(date: Date, timeZone: string): string {
  return zoneDateFormatter(timeZone).format(date)
}

// Anchoring at UTC-midnight lets the toLocale* formatters below (with `timeZone: 'UTC'`) read back
// the same calendar day on any runtime zone; otherwise a negative-offset zone renders the prior day.
function parseIsoDateUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

// UTC-midnight of an instant's *zone* calendar date — two zone-midnights are directly comparable
// for a whole-day diff regardless of the server's UTC clock.
export function zoneMidnight(date: Date, timeZone: string): Date {
  return parseIsoDateUtc(isoDateInZone(date, timeZone))
}

// UTC-midnight of the *zone's* current calendar date, so the UTC-based helpers read the right
// year/month/day — "today" follows the user's zone, not the UTC server clock.
export function todayInZone(timeZone: string): Date {
  return zoneMidnight(new Date(), timeZone)
}

// e.g. "Wed, Jun 3, 2025" — heatmap tooltip.
export function formatFullDate(isoDate: string): string {
  return parseIsoDateUtc(isoDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatLocaleDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString()
}

export function formatLocaleDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString()
}
