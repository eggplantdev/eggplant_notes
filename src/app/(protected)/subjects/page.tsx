import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getSubjects } from '@/features/subjects/queries'

// Subjects list. Server Component — RLS scopes getSubjects() to the signed-in user; the
// (protected) layout gates auth. Newest-first, with an empty-state CTA. Mirrors NotesPage.
export default async function SubjectsPage() {
  const subjects = await getSubjects()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Subjects</h1>
        <Button asChild>
          <Link href="/subjects/new">New subject</Link>
        </Button>
      </div>

      {subjects.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p>No subjects yet. Group your notes under one.</p>
          <Button asChild variant="outline">
            <Link href="/subjects/new">Create a subject</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {subjects.map((subject) => (
            <li key={subject.id}>
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
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
