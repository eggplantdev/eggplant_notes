import { z } from 'zod'

// min 8 must match Supabase `minimum_password_length` (supabase/config.toml) — NIST-8 baseline.
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

export const emailSchema = z.email('Enter a valid email address')

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
