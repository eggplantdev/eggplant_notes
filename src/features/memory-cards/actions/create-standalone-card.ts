'use server'

import { revalidatePath } from 'next/cache'

import { insertStandaloneCard } from '@/features/memory-cards/insert-standalone-card'
import { cardWithSubjectSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/create-server-client'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Cookie-client entry point for the standalone-card form. The write core (insertStandaloneCard) is
// shared with POST /api/memory-cards. Returns plain success; the form navigates to /memory-cards (known URL).
export async function createStandaloneCard(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(cardWithSubjectSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  try {
    await insertStandaloneCard(supabase, parsed.data)
  } catch (error) {
    console.error('[createStandaloneCard] insert error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create card',
    }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
