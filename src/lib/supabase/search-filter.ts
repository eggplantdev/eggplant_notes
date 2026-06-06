// Builds the argument for a PostgREST `.or(...)` that case-insensitively matches a free-text term
// across several text columns — the server-side `?q=` search shared by every paginated list read.
// Shared from birth: all three list queries (notes / memory cards / subjects) call it, so the
// escaping rules live in exactly one place.
//
// Escaping: the term is wrapped in double quotes so PostgREST's own structural characters
// (`,` separates filters, `.` separates column.op.value, `()` group) inside the user's text are
// taken literally instead of breaking the filter list. Inside a quoted value only `"` and `\`
// are special, so those are backslash-escaped. The surrounding `%…%` are the ilike wildcards;
// any `%`/`_` the user types stays live as a wildcard — acceptable for a search box.
//
// Returns null for a blank/whitespace-only term so callers can skip applying `.or()` entirely.
export function searchOr(columns: string[], q: string): string | null {
  const term = q.trim()
  if (!term) return null
  const escaped = term.replace(/["\\]/g, (ch) => `\\${ch}`)
  return columns.map((col) => `${col}.ilike."%${escaped}%"`).join(',')
}
