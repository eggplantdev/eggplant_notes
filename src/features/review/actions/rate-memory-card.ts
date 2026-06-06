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

// Server-trusted: the client sends only { memoryCardId, rating }; we compute the next FSRS state
// HERE (never trust a client-supplied schedule) and persist atomically via the record_review RPC
// (update memory_cards + insert review_events in one transaction, ownership self-enforced).
// Not runTableAction — that wrapper is single-schema/single-write; this has two inputs, an
// intermediate read + FSRS compute, and a void RPC, so the {success}/error envelope is hand-mirrored.
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
  // Goal is cosmetic (gates the dialog), so a bad value must never fail the rating — 0 makes detectGoalCrossing return undefined.
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
  // Refresh the standalone card page too, for when it's rated outside the dashboard queue.
  revalidatePath(`/memory-cards/${parsedId.data}`)
  return { success: true, celebrate }
}
