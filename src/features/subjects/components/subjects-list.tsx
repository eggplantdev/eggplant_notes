'use client'

import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'

import { AnimatedListItem } from '@/components/motion/animated-list-item'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { SubjectT } from '@/types/subject'

// Client island for the subjects list so rows can animate. Mirrors NotesList: server-fetched
// data passed in, popLayout + per-row layout for future add/remove/reorder transitions,
// initial={false} so the first render stays quiet under PageShell's page-transition.
export function SubjectsList({ subjects }: { subjects: SubjectT[] }) {
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {subjects.map((subject) => (
          <AnimatedListItem key={subject.id} layoutId={subject.id} layout>
            <Link href={`/subjects/${subject.id}`}>
              <Card className="hover:border-ring transition-colors">
                <CardHeader>
                  <CardTitle>{subject.title}</CardTitle>
                  {subject.description && (
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {subject.description}
                    </p>
                  )}
                </CardHeader>
              </Card>
            </Link>
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  )
}
