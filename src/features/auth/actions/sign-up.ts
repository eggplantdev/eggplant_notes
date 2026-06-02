'use server'

import { redirect } from 'next/navigation'

import { validateInput } from '@/features/auth/validate'
import { credentialsSchema } from '@/features/auth/schema'
import { createClient } from '@/lib/supabase/server'
import type { ActionResultT } from '@/features/auth/types'

export async function signUp(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(credentialsSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp(parsed.data)
  if (error) return { success: false, error: error.message }

  redirect('/dashboard')
}
