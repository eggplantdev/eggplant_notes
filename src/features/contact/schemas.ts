import { z } from 'zod'

// Only the two client-supplied fields. The sender's identity is NOT a field — the action reads it
// from the authenticated session (can't be spoofed, keeps the form minimal).
export const contactSchema = z.object({
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(120, 'Subject must be 120 characters or fewer'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message must be 2000 characters or fewer'),
})

export type ContactInputT = z.infer<typeof contactSchema>
