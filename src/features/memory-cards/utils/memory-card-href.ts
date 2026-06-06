// The single source for the memory-card detail/review deep-link. Every card on the /memory-cards
// listing opens its detail page at `/memory-cards/[id]` (the on-demand review surface), keyed by
// the card id alone. Sits beside memory-card-edit-href so the card route and its edit child share
// one source of truth and can't drift.
export function memoryCardHref(id: string): string {
  return `/memory-cards/${id}`
}
