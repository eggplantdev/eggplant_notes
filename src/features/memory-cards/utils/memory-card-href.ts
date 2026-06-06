// Single source for the card detail/review route, so it and its edit child can't drift.
export function memoryCardHref(id: string): string {
  return `/memory-cards/${id}`
}
