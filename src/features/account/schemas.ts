import { z } from 'zod'

// Step-up re-auth on the irreversible delete: only needs the current password present — Supabase
// verifies it via signInWithPassword. Not `passwordSchema` (that enforces the new-password floor;
// here we're checking an existing credential that may predate the floor).
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

export type DeleteAccountT = z.infer<typeof deleteAccountSchema>
