// The single source for the memory-card edit deep-link: the parent note's detail with the card's
// edit form open (`?edit=<id>`) and anchored to the form (`#memory-card-form`). Used by both entry
// points — the note-detail Edit link and the /memory-cards card's Edit button — so the `?edit=`
// param and the `#memory-card-form` anchor can't drift between them (the card→note differentiator).
export function memoryCardEditHref(noteId: string, id: string): string {
  return `/notes/${noteId}?edit=${id}#memory-card-form`
}
