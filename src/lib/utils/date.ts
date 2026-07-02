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

// A second per-zone formatter that also carries the clock fields, so `zoneOffsetMs` can read back a
// zone's wall time. `hourCycle: 'h23'` keeps midnight as `00`, not `24`.
const zoneOffsetFormatters = new Map<string, Intl.DateTimeFormat>()
function zoneOffsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zoneOffsetFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    zoneOffsetFormatters.set(timeZone, formatter)
  }
  return formatter
}

// Milliseconds to add to a UTC instant to get `timeZone`'s wall-clock reading — its UTC offset at
// that instant, DST included. Positive east of UTC (Warsaw = +1h/+2h).
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = zoneOffsetFormatter(timeZone).formatToParts(instant)
  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour'),
    field('minute'),
    field('second'),
  )
  return asUtc - instant.getTime()
}

// The REAL UTC instant of 00:00 for the zone calendar date `date` falls on. Distinct from
// `zoneMidnight`, which returns a synthetic UTC-anchored day *label* for whole-day diffing — this is
// the true instant, so it can bound a real timestamp column (`memory_cards.due_at`) in a query. The
// shift by the offset at that day's wall-midnight makes it DST-correct.
export function zoneStartOfDayInstant(date: Date, timeZone: string): Date {
  const wallMidnightAsUtc = new Date(`${isoDateInZone(date, timeZone)}T00:00:00Z`)
  return new Date(wallMidnightAsUtc.getTime() - zoneOffsetMs(wallMidnightAsUtc, timeZone))
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

// Whole-day signed diff between a due instant and today, both snapped to zone-midnight (DST-safe):
// negative = overdue, 0 = due today, positive = days remaining.
export function daysUntilDue(dueAt: string, timeZone: string): number {
  return Math.round(
    (zoneMidnight(new Date(dueAt), timeZone).getTime() - todayInZone(timeZone).getTime()) /
      MS_PER_DAY,
  )
}

export function formatFullDate(isoDate: string): string {
  return parseIsoDateUtc(isoDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Locale + timeZone are pinned so SSR (UTC, runtime locale) and the client (browser zone/locale)
// render byte-identical text — an unpinned toLocale* call differs between the two and trips React
// hydration error #418 on any page that prints these (e.g. /notes).
export function formatLocaleDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString('en-US', { timeZone: APP_TIME_ZONE })
}

export function formatLocaleDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString('en-US', { timeZone: APP_TIME_ZONE })
}
