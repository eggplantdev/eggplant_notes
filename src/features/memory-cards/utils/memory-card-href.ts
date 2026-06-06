// Single source for the card detail/review route, beside memory-card-edit-href so the card route
// and its edit child can't drift.
export function memoryCardHref(id: string): string {
  return `/memory-cards/${id}`
}
