'use client'

import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'

import { AnimatedListItem } from '@/components/motion/animated-list-item'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { NoteT } from '@/types/note'

// Client island for the notes list so rows can animate. Data is still fetched on the server
// (NotesPage) and passed in. popLayout + per-row layout/layoutId means future client-side
// add/remove/reorder transitions slide neighbors into place; initial={false} keeps the first
// render quiet so it doesn't compete with PageShell's page-transition.
export function NotesList({ notes }: { notes: NoteT[] }) {
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {notes.map((note) => (
          <AnimatedListItem key={note.id} layoutId={note.id} layout>
            <Link href={`/notes/${note.id}`}>
              <Card className="hover:border-ring transition-colors">
                <CardHeader>
                  <CardTitle>{note.title ?? 'Untitled'}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    {new Date(note.created_at).toLocaleDateString()}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  )
}
