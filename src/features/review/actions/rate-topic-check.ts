'use server'

import { revalidatePath } from 'next/cache'

import { ratingSchema } from '@/features/review/schemas'
import { applyRating, serializeCard } from '@/features/review/scheduling'
import { topicCheckIdSchema } from '@/features/topic-checks/schemas'
import { createClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// The one mutation that closes the recall loop (FR-016–018). Server-trusted: the client island
// sends only { topicCheckId, rating }. We re-fetch the card row (RLS scopes it to the owner),
// compute the next FSRS state HERE — never trust a client-supplied schedule — and persist
// atomically via the record_review RPC (one transaction: update topic_checks + insert
// review_events; its update-first ownership guard self-enforces the card<->caller link).
// `user_id` is never sent (DB defaults auth.uid()).
export async function rateTopicCheck(
  topicCheckId: string,
  rating: unknown,
): Promise<ActionResultT> {
  const parsedId = validateInput(topicCheckIdSchema, topicCheckId)
  if (!parsedId.success) return parsedId

  const parsedRating = validateInput(ratingSchema, rating)
  if (!parsedRating.success) return parsedRating

  const supabase = await createClient()
  const { data: row, error: fetchError } = await supabase
    .from('topic_checks')
    .select('*')
    .eq('id', parsedId.data)
    .maybeSingle()
  if (fetchError) {
    console.error('[rateTopicCheck] fetch error', fetchError)
    return { success: false, error: fetchError.message }
  }
  if (!row) return { success: false, error: 'Topic check not found' }

  const card = applyRating(row, parsedRating.data, new Date())
  const { error } = await supabase.rpc('record_review', {
    p_topic_check_id: parsedId.data,
    p_rating: parsedRating.data,
    p_card: serializeCard(card),
  })
  if (error) {
    console.error('[rateTopicCheck] record_review error', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/review')
  revalidatePath('/dashboard')
  return { success: true }
}
