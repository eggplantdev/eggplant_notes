'use server'

import { z } from 'zod'

import { getNotesForLinking } from '@/features/notes/queries'
import { validateInput } from '@/lib/validate'

// Exposes getNotesForLinking to the client link dialog (queries are server-only — same pattern as
// generateCards reached from the topic generator). `subjectId` is null (unfiled notes) or a subject
// guid; shape-only validation, RLS owns ownership. Bad input → empty list (no notes to offer).
const subjectFilterSchema = z.guid('Invalid subject id').nullable()

export async function getNotesForLinkingAction(
  subjectId: string | null,
): Promise<{ id: string; title: string | null }[]> {
  const parsed = validateInput(subjectFilterSchema, subjectId)
  if (!parsed.success) return []
  return getNotesForLinking(parsed.data)
}
