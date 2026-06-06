// The single source for the memory-card edit deep-link. Post standalone-memory-cards every card —
// linked or standalone — edits at the unified route `/memory-cards/[id]/edit`, keyed by the card
// id alone (no longer routed through the parent note's `?edit=` inline form). Used by both entry
// points (the note-detail Edit link and the /memory-cards card's Edit button) so the path can't
// drift between them.
export function memoryCardEditHref(id: string): string {
  return `/memory-cards/${id}/edit`
}
