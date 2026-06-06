// Single source for the card edit deep-link, so the note-detail and /memory-cards entry points
// can't drift.
export function memoryCardEditHref(id: string): string {
  return `/memory-cards/${id}/edit`
}
