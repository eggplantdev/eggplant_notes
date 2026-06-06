// Builds the argument for a case-insensitive PostgREST `.or(...)` across text columns (the `?q=`
// search). The term is double-quoted so PostgREST's structural chars (`,` `.` `()`) in user text
// are literal, not filter syntax; inside a quoted value only `"` and `\` are special, so those are
// escaped. `%`/`_` the user types stay live as ilike wildcards — acceptable for a search box.
// Returns null for a blank term so callers can skip `.or()` entirely.
export function searchOr(columns: string[], q: string): string | null {
  const term = q.trim()
  if (!term) return null
  const escaped = term.replace(/["\\]/g, (ch) => `\\${ch}`)
  return columns.map((col) => `${col}.ilike."%${escaped}%"`).join(',')
}
