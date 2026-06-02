'use server'

import { redirect } from 'next/navigation'

import { validateInput } from '@/features/auth/validate'
import { credentialsSchema } from '@/features/auth/schema'
import { createClient } from '@/lib/supabase/server'
import type { ActionResultT } from '@/types/action'

export async function signIn(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(credentialsSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { success: false, error: error.message }

  redirect('/dashboard')
}
