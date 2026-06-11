'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import type { ActionResultT } from '@/types/action'

export async function signIn(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(credentialsSchema, input, (supabase, data) =>
    supabase.auth.signInWithPassword(data),
  )
  if (!result.success) return result

  // Drop any client Router Cache from a prior session in this browser so a different user can't be
  // served the previous one's cached authed pages. Before redirect — redirect() throws to unwind.
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
