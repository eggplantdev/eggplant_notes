'use server'

import { isAccountEmpty } from '@/features/sample-data/queries'
import { remapSampleData } from '@/features/sample-data/remap'
import { generateReviewHistory } from '@/features/sample-data/review-history'
import { SAMPLE_DATA } from '@/features/sample-data/sample-data'
import { loadSampleDataSchema } from '@/features/sample-data/schemas'
import {
  deleteAllUserContent,
  deleteSeededRows,
  revalidateSeedPaths,
} from '@/features/sample-data/seed-rows'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Empty account → remap → ordered insert → rollback-on-failure (every row flagged is_seeded).
// Non-empty account → password step-up re-auth → wipe ALL content → same load. The wipe restores
// the empty-account state, so the blanket is_seeded rollback below stays safe either way.
export async function loadSampleData(input?: unknown): Promise<ActionResultT> {
  const parsed = validateInput(loadSampleDataSchema, input ?? {})
  if (!parsed.success) return parsed

  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  // Fail closed: isAccountEmpty THROWS on a DB error. Unhandled, that rejects the Server Action and the
  // client transition never resolves — the dialog hangs in isPending. Surface a generic error instead.
  let accountEmpty: boolean
  try {
    accountEmpty = await isAccountEmpty(supabase)
  } catch (probeError) {
    console.error('[loadSampleData] account-state probe failed:', probeError)
    return { success: false, error: 'Could not verify your account state. Please try again.' }
  }

  if (!accountEmpty) {
    if (!user.email) return { success: false, error: 'Not authenticated' }

    const { password } = parsed.data
    if (!password) return { success: false, error: 'Password is required' }

    // Step-up re-auth: a live session alone must not be enough to wipe existing data (mirrors the
    // account-delete guard — protects a hijacked/left-open session).
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    if (reauthError) return { success: false, error: 'Incorrect password' }

    const wipe = await deleteAllUserContent(supabase, user.id)
    if (wipe.error) {
      console.error('[loadSampleData] wipe failed:', wipe.error)
      return { success: false, error: wipe.error }
    }
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

  // remap assigns every card an id, so this never narrows the set — the filter just satisfies the
  // optional-id type without a non-null assertion.
  const cardIds = cards.map((c) => c.id).filter((id): id is string => Boolean(id))
  const reviewEvents = generateReviewHistory(cardIds, user.id, new Date())

  // FK order: subjects → notes → cards → review_events (events reference card ids). supabase-js
  // inserts are NOT one transaction, so any failure rolls back via the shared clear path — a failed
  // load must never leave a half-seeded account. (review_events cascade from memory_cards on delete.)
  const steps = [
    () => supabase.from('subjects').insert(subjects),
    () => supabase.from('notes').insert(notes),
    () => supabase.from('memory_cards').insert(cards),
    () => supabase.from('review_events').insert(reviewEvents),
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
