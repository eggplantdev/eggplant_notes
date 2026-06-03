import { z } from 'zod'

// The review grade crossing the Server-Action boundary: FSRS Rating.Again(1)..Easy(4).
// coerce because the client island passes the grade as a number through the action args,
// which arrive loosely typed. (topicCheckId reuses topic-checks' topicCheckIdSchema.)
export const ratingSchema = z.coerce.number().int().min(1).max(4)
