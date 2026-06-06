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

// Server Component (renders the server-only Shiki RenderMarkdown). This section only ADDS cards —
// editing lives at the /memory-cards/[id]/edit route.
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
            // Scroll target for the `/notes/[id]#card-<id>` deep link; scroll-mt clears the sticky nav.
            <li key={card.id} id={`card-${card.id}`} className="scroll-mt-24">
              <Card>
                {/* CardAction sits in col 2 / row-span-2 so the buttons flank both title and
                    description; the code block stays full-width below in CardContent. */}
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
