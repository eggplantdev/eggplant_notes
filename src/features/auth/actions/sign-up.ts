'use server'

import { redirect } from 'next/navigation'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import type { ActionResultT } from '@/types/action'

export async function signUp(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(credentialsSchema, input, (supabase, data) =>
    supabase.auth.signUp(data),
  )
  if (!result.success) return result

  redirect('/dashboard?toast=signed-up')
}
