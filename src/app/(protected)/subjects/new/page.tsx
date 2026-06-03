import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { createSubject } from '@/features/subjects/actions/create-subject'
import { SubjectForm } from '@/features/subjects/subject-form'

// Create page. Server Component hosting the client SubjectForm island; passes createSubject
// down as a prop. Inherits the (protected) auth gate.
export default function NewSubjectPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/subjects">← Subjects</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">New subject</h1>
      <SubjectForm action={createSubject} />
    </main>
  )
}
