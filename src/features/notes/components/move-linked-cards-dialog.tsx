'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/section-label'
import { cn } from '@/lib/utils'

type CardChoiceT = 'move' | 'unlink'
export type LinkedCardT = { id: string; prompt: string }

// `id` makes the layoutId unique per row, so each row's pill animates on its own instead of all
// of them sharing one.
function ChoiceToggle({
  id,
  value,
  onChange,
}: {
  id: string
  value: CardChoiceT
  onChange: (choice: CardChoiceT) => void
}) {
  const options: CardChoiceT[] = ['move', 'unlink']
  return (
    <div className="border-input relative inline-flex shrink-0 overflow-hidden rounded-md border">
      {options.map((option) => {
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className="relative px-3 py-1 text-xs font-medium capitalize"
          >
            {active && (
              <motion.span
                layoutId={`move-toggle-${id}`}
                className="bg-primary absolute inset-0"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span
              className={cn(
                'relative z-10 transition-colors',
                active ? 'text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {option}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Per-card Move/Unlink decision dialog shown when a note's subject changes and it has linked
// cards. Move keeps a card linked (preserving the invariant that a linked card shares its note's
// subject); Unlink drops the link. Mounted only while a decision is pending, so its choices state
// starts fresh each time.
export function MoveLinkedCardsDialog({
  cards,
  onConfirm,
  onCancel,
}: {
  cards: LinkedCardT[]
  onConfirm: (actions: { move: string[]; unlink: string[] }) => void
  onCancel: () => void
}) {
  const [choices, setChoices] = useState<Record<string, CardChoiceT>>(() =>
    Object.fromEntries(cards.map((c) => [c.id, 'move'])),
  )
  const setAll = (choice: CardChoiceT) =>
    setChoices(Object.fromEntries(cards.map((c) => [c.id, choice])))

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader className="gap-3">
          <AlertDialogTitle>Move linked memory cards?</AlertDialogTitle>
          <AlertDialogDescription>
            You changed this note&apos;s subject.
            <br />
            For each linked memory card, <strong>move</strong> it to the new subject (stays linked)
            or <strong>unlink</strong> it (keeps its subject but is no longer attached to the note).
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center justify-between gap-2">
          <SectionLabel as="span">Apply to all</SectionLabel>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAll('move')}>
              Move all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAll('unlink')}>
              Unlink all
            </Button>
          </div>
        </div>

        <ul className="flex max-h-64 flex-col gap-2 overflow-auto">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <span className="line-clamp-1 min-w-0 flex-1 text-sm">{card.prompt}</span>
              <ChoiceToggle
                id={card.id}
                value={choices[card.id]}
                onChange={(choice) => setChoices((prev) => ({ ...prev, [card.id]: choice }))}
              />
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="move-cards-confirm"
            onClick={() =>
              onConfirm({
                move: cards.filter((c) => choices[c.id] === 'move').map((c) => c.id),
                unlink: cards.filter((c) => choices[c.id] === 'unlink').map((c) => c.id),
              })
            }
          >
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
