// UTC date helpers for the dashboard. All date math runs in UTC so the `YYYY-MM-DD` keys
// the heatmap joins on stay stable regardless of the runtime timezone. Feature-local (only
// the dashboard needs them) — promote to src/lib/ only if a second feature does.

// Midnight-UTC epoch ms for a date, dropping any time-of-day.
export function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// `YYYY-MM-DD` for an epoch-ms instant.
export function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
