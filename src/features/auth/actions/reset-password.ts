'use server'

import { headers } from 'next/headers'

import { validateInput } from '@/features/auth/validate'
import { resetRequestSchema } from '@/features/auth/schema'
import { createClient } from '@/lib/supabase/server'
import type { ActionResultT } from '@/types/action'

export async function resetPassword(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(resetRequestSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const origin = (await headers()).get('origin') ?? 'http://127.0.0.1:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/api/auth/confirm?type=recovery`,
  })
  if (error) return { success: false, error: error.message }

  return { success: true }
}
