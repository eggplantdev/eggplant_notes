// Fractional midpoint for a note dropped between its new neighbors. Top → half the next
// position (stays positive, below it); bottom → just above the last; middle → the average.
// Used by the S-15 docs-view sidebar (SubjectNoteSidebar) reorder; kept as a standalone unit-
// tested helper. Known degeneracy: repeated midpoints between two close values exhaust float
// precision (no rebalance) — pre-existing, accepted.
export function midpoint(
  prev: number | undefined,
  next: number | undefined,
  fallback: number,
): number {
  if (prev !== undefined && next !== undefined) return (prev + next) / 2
  if (prev !== undefined) return prev + 1
  if (next !== undefined) return next / 2
  return fallback
}
