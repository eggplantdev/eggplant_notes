import { z } from 'zod'

import type { CardStatsT } from '@/features/dashboard/types'

// Runtime-validates the card_stats RPC's jsonb payload at the boundary, so a future SQL key change
// throws loudly here instead of silently surfacing `undefined` downstream. `satisfies
// z.ZodType<CardStatsT>` keeps this schema and the hand-written type from drifting apart.
export const cardStatsSchema = z.object({
  overdue: z.number(),
  dueNow: z.number(),
  reviewsInWindow: z.number(),
  good: z.number(),
  hardest: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      noteId: z.string().nullable(),
      noteTitle: z.string(),
      lapses: z.number(),
      stability: z.number(),
    }),
  ),
}) satisfies z.ZodType<CardStatsT>
