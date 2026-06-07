import { z } from 'zod'

// Only the two client-supplied fields. The sender's identity is NOT a field — the action reads it
// from the authenticated session (can't be spoofed, keeps the form minimal).
export const contactSchema = z.object({
  subject: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
})

export type ContactInputT = z.infer<typeof contactSchema>
