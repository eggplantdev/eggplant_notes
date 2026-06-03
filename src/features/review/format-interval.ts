// Anki-style relative interval for a rating-button preview: "1m", "10m", "4h", "3d", "2mo",
// "1y". Pre-formatted server-side so the client island ships no date math. Rounds to the
// coarsest unit that fits; clamps the minimum to "1m" so an imminent due never reads "0m".
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60_000)
  if (minutes < 60) return `${Math.max(minutes, 1)}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.round(months / 12)}y`
}
