import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Separator } from '@/components/ui/separator'
import { AddMemoryCard } from '@/features/memory-cards/components/add-memory-card'
import {
  NoteMemoryCardsList,
  type NoteCardRowT,
} from '@/features/memory-cards/components/note-memory-cards-list'
import type { MemoryCardT } from '@/features/memory-cards/types'
import { GenerateCardsButton } from '@/features/memory-cards/components/generate-cards-button'

type MemoryCardsSectionPropsT = {
  noteId: string
  // The note's already-loaded text, forwarded to the AI card generator so its prompt preview needs
  // no extra fetch.
  noteTitle: string | null
  noteContent: string
  cards: MemoryCardT[]
  // Whether OpenRouter is connected. The AI card-generation entry point (#1) always shows; when not
  // connected, the button opens the connect dialog instead of generating.
  aiEnabled: boolean
  // The user's persisted default model, pre-selected in the generate dialog.
  defaultModel: string
}

// This section only ADDS cards — editing lives at the /memory-cards/[id]/edit route. The card list
// renders through NoteMemoryCardsList (the shared listing shell), expanded with each card's answer
// body. The body (example + code_context) is pre-rendered HERE via the server-only Shiki
// RenderMarkdown and handed down as a ReactNode, because that component can't run inside the client
// list. Pass `answer: undefined` instead to get the compact (listing-style) card.
export function MemoryCardsSection({
  noteId,
  noteTitle,
  noteContent,
  cards,
  aiEnabled,
  defaultModel,
}: MemoryCardsSectionPropsT) {
  const rows: NoteCardRowT[] = cards.map((card) => ({
    card,
    answer:
      card.example || card.code_context ? (
        // Separator divides the question from its answer; gap-4 keeps the body from crowding it.
        <div className="flex flex-col gap-2">
          <Separator />
          {card.example && <RenderMarkdown content={card.example} />}
          {card.code_context && <RenderMarkdown content={card.code_context} />}
        </div>
      ) : undefined,
  }))

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Memory cards</h2>

      <div className={`flex gap-2`}>
        <AddMemoryCard noteId={noteId} />
        <GenerateCardsButton
          noteId={noteId}
          noteTitle={noteTitle}
          noteContent={noteContent}
          connected={aiEnabled}
          defaultModel={defaultModel}
        />
      </div>

      {cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No memory cards yet. Add one above to start building your recall set.
        </p>
      ) : (
        <NoteMemoryCardsList rows={rows} noteId={noteId} />
      )}
    </section>
  )
}
