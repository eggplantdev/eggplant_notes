// Fractional midpoint for a note dropped between its new neighbors (no sequence rebalance).
// Known degeneracy: repeated midpoints between two close values exhaust float precision —
// accepted.
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
