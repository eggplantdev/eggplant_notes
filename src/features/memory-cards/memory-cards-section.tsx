import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { ButtonLink } from '@/components/ui/button-link'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AddMemoryCard } from '@/features/memory-cards/add-memory-card'
import { DeleteMemoryCardButton } from '@/features/memory-cards/delete-memory-card-button'
import { UnlinkCardButton } from '@/features/memory-cards/unlink-card-button'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { memoryCardEditHref } from '@/features/memory-cards/utils'

type MemoryCardsSectionPropsT = {
  noteId: string
  cards: MemoryCardT[]
}

// Server Component (async — renders the server-only Shiki RenderMarkdown). Owns the "all cards on
// a note" view (FR-015). Editing a card now lives at the unified /memory-cards/[id]/edit route
// (standalone-memory-cards), so this section only ADDS cards: the add form is deferred behind
// <AddMemoryCard> so a read view mounts no CodeMirror. Optional example/code_context render only
// when present.
export async function MemoryCardsSection({ noteId, cards }: MemoryCardsSectionPropsT) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Memory cards</h2>

      <AddMemoryCard noteId={noteId} />

      {cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No memory cards yet. Add one above to start building your recall set.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            // id + scroll-mt make this a scroll target for the /memory-cards card→note deep link
            // (`/notes/[id]#card-<id>`); scroll-mt keeps the sticky nav from covering it.
            <li key={card.id} id={`card-${card.id}`} className="scroll-mt-24">
              <Card>
                {/* CardHeader's grid keeps prompt + example in column 1 and the actions in
                    CardAction (col-start-2, row-span-2), so the buttons sit beside the title AND
                    description — not above them — matching the standalone memory-cards list. The
                    code block is a full-width content block, so it stays below in CardContent. */}
                <CardHeader className="gap-x-4">
                  <CardTitle>{card.prompt}</CardTitle>
                  {card.example && (
                    <CardDescription>
                      <RenderMarkdown content={card.example} />
                    </CardDescription>
                  )}
                  <CardAction className="flex items-center gap-2">
                    <ButtonLink href={memoryCardEditHref(card.id)} variant="outline" size="sm">
                      Edit
                    </ButtonLink>
                    <UnlinkCardButton id={card.id} noteId={noteId} />
                    <DeleteMemoryCardButton noteId={noteId} id={card.id} />
                  </CardAction>
                </CardHeader>
                {card.code_context && (
                  <CardContent>
                    <RenderMarkdown content={card.code_context} />
                  </CardContent>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
