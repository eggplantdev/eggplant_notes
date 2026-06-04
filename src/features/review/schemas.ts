import { z } from 'zod'

// The review grade crossing the Server-Action boundary: FSRS Rating.Again(1)..Easy(4).
// coerce because the client island passes the grade as a number through the action args,
// which arrive loosely typed. (topicCheckId reuses topic-checks' topicCheckIdSchema.)
export const ratingSchema = z.coerce.number().int().min(1).max(4)

// The daily goal crossing the Server-Action boundary. It's route-joined from a trusted server
// read but arrives via the client island, so we still validate shape. Coerce because action args
// arrive loosely typed. No upper bound needed here — it's cosmetic (gates a congrats dialog).
export const goalSchema = z.coerce.number().int().min(1)
