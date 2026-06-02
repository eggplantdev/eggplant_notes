'use server'

import { redirect } from 'next/navigation'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import type { ActionResultT } from '@/types/action'

export async function signIn(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(credentialsSchema, input, (supabase, data) =>
    supabase.auth.signInWithPassword(data),
  )
  if (!result.success) return result

  redirect('/dashboard')
}
