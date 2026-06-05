// The single source for the topic-check edit deep-link: the parent note's detail with the check's
// edit form open (`?edit=<id>`) and anchored to the form (`#topic-check-form`). Used by both entry
// points — the note-detail Edit link and the /topic-checks card's Edit button — so the `?edit=`
// param and the `#topic-check-form` anchor can't drift between them (the card→note differentiator).
export function topicCheckEditHref(noteId: string, id: string): string {
  return `/notes/${noteId}?edit=${id}#topic-check-form`
}
