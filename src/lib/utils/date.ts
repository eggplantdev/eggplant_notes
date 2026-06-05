// Shared date/time utilities. Promoted from features/dashboard/utils on the 2nd consumer
// (features/review-events now buckets review activity by the same zone), per the feature-first
// rule. All day math runs in UTC so the `YYYY-MM-DD` keys the heatmap + streak join on stay
// stable regardless of the runtime timezone (Vercel functions run in UTC).

export const MS_PER_DAY = 86_400_000

// The single calendar zone the app buckets review activity / streak / heatmap "today" by.
// This is a solo personal tool, so one fixed zone is correct and simplest. Vercel functions
// run in UTC, so a naive `::date` / `new Date()` would bucket a late-night (local) review into
// the next UTC day — bucketing in this zone keeps "today" matching the user's clock.
export const APP_TIME_ZONE = 'Europe/Warsaw'

// Midnight-UTC epoch ms for a date, dropping any time-of-day.
export function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// `YYYY-MM-DD` for an epoch-ms instant.
export function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// `Intl.DateTimeFormat` construction loads ICU locale/zone data, so it's the costly part of
// formatting. These helpers run per-row on list/heatmap renders, so memoize one formatter per
// timezone instead of rebuilding it on every call.
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

// `YYYY-MM-DD` for an instant as seen in a given IANA timezone. `en-CA` formats as
// ISO year-month-day, which is the join key both the activity buckets and the heatmap use.
export function isoDateInZone(date: Date, timeZone: string): string {
  return zoneDateFormatter(timeZone).format(date)
}

// A `YYYY-MM-DD` calendar date parsed to a Date at UTC-midnight. Anchoring at UTC lets the
// toLocale* formatters below (with `timeZone: 'UTC'`) read back the same calendar day on any
// runtime zone — without this, a `new Date('2025-06-03')` formatted in a negative-offset zone
// would render the previous day.
function parseIsoDateUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

// A Date at UTC-midnight of an instant's *zone* calendar date. Two zone-midnights are directly
// comparable for a whole-day diff regardless of the server's UTC clock (used by the memory-card
// review-status label).
export function zoneMidnight(date: Date, timeZone: string): Date {
  return parseIsoDateUtc(isoDateInZone(date, timeZone))
}

// A Date at UTC-midnight of the *zone's* current calendar date. Returned this way so the
// UTC-based helpers (utcMidnight / toISODate, used by the heatmap + streak) read the right
// year/month/day — i.e. "today" follows the user's zone, not the UTC server clock.
export function todayInZone(timeZone: string): Date {
  return zoneMidnight(new Date(), timeZone)
}

// --- Display formatters (presentation only) ---

// Full weekday + date for a `YYYY-MM-DD` calendar date, e.g. "Wed, Jun 3, 2025". Heatmap tooltip.
export function formatFullDate(isoDate: string): string {
  return parseIsoDateUtc(isoDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Locale date for a timestamp instant (ISO string / ms / Date), e.g. "6/5/2026".
export function formatLocaleDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString()
}

// Locale date + time for a timestamp instant, e.g. "6/5/2026, 2:32:45 PM".
export function formatLocaleDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString()
}
