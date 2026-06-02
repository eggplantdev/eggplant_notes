'use server'

import { redirect } from 'next/navigation'

import { validateInput } from '@/features/auth/validate'
import { updatePasswordSchema } from '@/features/auth/schema'
import { createClient } from '@/lib/supabase/server'
import type { ActionResultT } from '@/types/action'

export async function updatePassword(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(updatePasswordSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { success: false, error: error.message }

  redirect('/dashboard')
}
