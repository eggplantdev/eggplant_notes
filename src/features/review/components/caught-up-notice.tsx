// Shared "no cards due" message — rendered by ReviewPanel's empty branch and by CardReviewQueue when
// the queue empties mid-session, so the copy stays in one place.
export function CaughtUpNotice() {
  return (
    <p className="text-muted-foreground text-center text-sm">
      All caught up 🎉 — no memory cards are due right now.
    </p>
  )
}
