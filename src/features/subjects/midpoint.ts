// Fractional midpoint for a note dropped between its new neighbors. Top → half the next
// position (stays positive, below it); bottom → just above the last; middle → the average.
// Shared by the continuous-view ToC (ReorderableNoteList) and the S-15 docs-view sidebar
// (SubjectNoteSidebar) — promoted out of the component on its 2nd consumer per the
// feature-first rule. Known degeneracy: repeated midpoints between two close values exhaust
// float precision (no rebalance) — pre-existing, accepted.
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
