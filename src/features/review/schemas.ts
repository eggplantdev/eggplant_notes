import { z } from 'zod'

// FSRS Rating 1..4. Coerce because action args arrive loosely typed.
export const ratingSchema = z.coerce.number().int().min(1).max(4)

// Coerce because action args arrive loosely typed. No upper bound — it's cosmetic (gates the dialog).
export const goalSchema = z.coerce.number().int().min(1)
