import Link from 'next/link'
import { redirect } from 'next/navigation'

import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Button } from '@/components/ui/button'
import { AddMemoryCard } from '@/features/memory-cards/add-memory-card'
import { DeleteMemoryCardButton } from '@/features/memory-cards/delete-memory-card-button'
import { MemoryCardForm } from '@/features/memory-cards/memory-card-form'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { memoryCardEditHref } from '@/features/memory-cards/utils'

type MemoryCardsSectionPropsT = {
  noteId: string
  checks: MemoryCardT[]
  editId?: string
}

// Server Component (async — renders the server-only Shiki RenderMarkdown). Owns the "all
// checks on a note" view (FR-015). Edit state is the URL `?edit=<id>` param (editId), so
// there's no client list state: an Edit link re-renders this on the server with the form
// seeded for that check (`key` forces the client form to remount when the edit target
// changes). When NOT editing, the add form is deferred behind <AddMemoryCard> so a read view
// mounts no CodeMirror. Optional example/code_context render only when present.
export async function MemoryCardsSection({ noteId, checks, editId }: MemoryCardsSectionPropsT) {
  const editingCheck = editId ? checks.find((c) => c.id === editId) : undefined
  // Stale ?edit (check deleted or never owned): drop the param so the URL matches the
  // add-mode form it would fall back to, instead of claiming edit of a row that isn't there.
  if (editId && !editingCheck) redirect(`/notes/${noteId}`)

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Memory cards</h2>

      {editingCheck ? (
        <MemoryCardForm key={editId} noteId={noteId} check={editingCheck} />
      ) : (
        <AddMemoryCard noteId={noteId} />
      )}

      {checks.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No memory cards yet. Add one above to start building your recall set.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {checks.map((check) => (
            // id + scroll-mt make this a scroll target for the /memory-cards card→note deep link
            // (`/notes/[id]#check-<id>`); scroll-mt keeps the sticky nav from covering it.
            <li
              key={check.id}
              id={`check-${check.id}`}
              className="flex scroll-mt-24 flex-col gap-2 rounded-lg border p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium">{check.prompt}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={memoryCardEditHref(noteId, check.id)}>Edit</Link>
                  </Button>
                  <DeleteMemoryCardButton noteId={noteId} id={check.id} />
                </div>
              </div>
              {check.example && (
                <div className="text-sm">
                  <RenderMarkdown content={check.example} />
                </div>
              )}
              {check.code_context && <RenderMarkdown content={check.code_context} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
