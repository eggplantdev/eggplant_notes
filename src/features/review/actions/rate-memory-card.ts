'use server'

import { revalidatePath } from 'next/cache'

import { detectGoalCrossing } from '@/features/review/detect-goal-crossing'
import { goalSchema, ratingSchema } from '@/features/review/schemas'
import { applyRating, serializeCard } from '@/features/review/scheduling'
import type { RateResultT } from '@/features/review/types'
import { getReviewedTodayCount, getReviewsThisWeekCount } from '@/features/review-events/queries'
import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'

// The one mutation that closes the recall loop (FR-016–018). Server-trusted: the client island
// sends only { memoryCardId, rating }. We re-fetch the card row (RLS scopes it to the owner),
// compute the next FSRS state HERE — never trust a client-supplied schedule — and persist
// atomically via the record_review RPC (one transaction: update memory_cards + insert
// review_events; its update-first ownership guard self-enforces the card<->caller link).
// `user_id` is never sent (DB defaults auth.uid()). Deliberately does NOT use runTableAction:
// that wrapper is single-schema → single PostgREST write → .select().single(); this has two
// inputs (id + rating), an intermediate server-side read + FSRS compute, and an RPC that
// returns void — so the {success}/error envelope is mirrored by hand here instead.
export async function rateMemoryCard(
  memoryCardId: string,
  rating: unknown,
  goal: unknown,
): Promise<RateResultT> {
  const parsedId = validateInput(memoryCardIdSchema, memoryCardId)
  if (!parsedId.success) return parsedId

  const parsedRating = validateInput(ratingSchema, rating)
  if (!parsedRating.success) return parsedRating

  const supabase = await createClient()
  // Goal is cosmetic (gates the congrats dialog), so a bad value must never fail the rating —
  // fall back to 0, which makes detectGoalCrossing return undefined (no celebration).
  const goalParsed = goalSchema.safeParse(goal)
  const dailyGoal = goalParsed.success ? goalParsed.data : 0

  const [{ data: row, error: fetchError }, dailyBefore, weeklyBefore] = await Promise.all([
    supabase.from('memory_cards').select('*').eq('id', parsedId.data).maybeSingle(),
    getReviewedTodayCount(supabase),
    getReviewsThisWeekCount(supabase),
  ])
  if (fetchError) {
    console.error('[rateMemoryCard] fetch error', fetchError)
    return { success: false, error: fetchError.message }
  }
  if (!row) return { success: false, error: 'Memory card not found' }

  const card = applyRating(row, parsedRating.data, new Date())
  const { error } = await supabase.rpc('record_review', {
    p_memory_card_id: parsedId.data,
    p_rating: parsedRating.data,
    p_card: serializeCard(card),
  })
  if (error) {
    console.error('[rateMemoryCard] record_review error', error)
    return { success: false, error: error.message }
  }

  const [dailyAfter, weeklyAfter] = await Promise.all([
    getReviewedTodayCount(supabase),
    getReviewsThisWeekCount(supabase),
  ])
  const celebrate = detectGoalCrossing({
    dailyBefore,
    dailyAfter,
    weeklyBefore,
    weeklyAfter,
    dailyGoal,
  })

  revalidatePath('/dashboard')
  return { success: true, celebrate }
}
