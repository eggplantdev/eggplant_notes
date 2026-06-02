import { z } from 'zod'

// Local Supabase `minimum_password_length = 6` (supabase/config.toml).
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters')

const emailSchema = z.email('Enter a valid email address')

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const resetRequestSchema = z.object({
  email: emailSchema,
})

export const updatePasswordSchema = z.object({
  password: passwordSchema,
})

export type CredentialsT = z.infer<typeof credentialsSchema>
export type ResetRequestT = z.infer<typeof resetRequestSchema>
export type UpdatePasswordT = z.infer<typeof updatePasswordSchema>
