'use server'

import { isAccountEmpty } from '@/features/sample-data/queries'
import { remapSampleData } from '@/features/sample-data/remap'
import { SAMPLE_DATA } from '@/features/sample-data/sample-data'
import { deleteSeededRows, revalidateSeedPaths } from '@/features/sample-data/seed-rows'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { ActionResultT } from '@/types/action'

// Guard → remap → ordered insert → rollback-on-failure. Every row is flagged is_seeded.
export async function loadSampleData(): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  // Empty-account guard also makes the blanket is_seeded rollback safe: no pre-existing seeded rows to delete.
  if (!(await isAccountEmpty(supabase))) {
    return { success: false, error: 'Sample data can only be loaded into an empty account.' }
  }

  // Memoized id generator: same ref → same fresh id, so child FKs resolve to their parent's id.
  const ids = new Map<string, string>()
  const idFor = (ref: string): string => {
    const existing = ids.get(ref)
    if (existing) return existing
    const id = crypto.randomUUID()
    ids.set(ref, id)
    return id
  }

  const { subjects, notes, cards } = remapSampleData(SAMPLE_DATA, user.id, idFor)

  // FK order: subjects → notes → cards. supabase-js inserts are NOT one transaction, so any failure
  // rolls back via the shared clear path — a failed load must never leave a half-seeded account.
  const steps = [
    () => supabase.from('subjects').insert(subjects),
    () => supabase.from('notes').insert(notes),
    () => supabase.from('memory_cards').insert(cards),
  ]
  for (const step of steps) {
    const { error } = await step()
    if (error) {
      // If the rollback ITSELF fails the account is left half-seeded — surface that so the user knows to recover via Clear.
      const rollback = await deleteSeededRows(supabase)
      console.error(
        '[loadSampleData]',
        error,
        rollback.error ? `rollback failed: ${rollback.error}` : '',
      )
      const hint = rollback.error
        ? ' Some sample data may remain — use “Clear sample data” to reset.'
        : ''
      return { success: false, error: `${error.message}${hint}` }
    }
  }

  revalidateSeedPaths()
  return { success: true }
}
