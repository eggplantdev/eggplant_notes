// Shared "no cards due" message — rendered by ReviewPanel's empty branch (the dashboard, when its
// due queue is empty). On /memory-cards the panel reviews ahead instead of dead-ending here.
export function CaughtUpNotice() {
  return (
    <p className="text-muted-foreground text-center text-sm">
      All caught up 🎉 — no memory cards are due right now.
    </p>
  )
}
