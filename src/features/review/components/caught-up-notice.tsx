// "No cards due" message — rendered by ReviewPanel's empty branch when there's no card to show at
// all in the active filter scope (nothing due and nothing to review ahead).
export function CaughtUpNotice() {
  return (
    <p className="text-muted-foreground text-center text-sm">
      All caught up 🎉 — no memory cards are due right now.
    </p>
  )
}
