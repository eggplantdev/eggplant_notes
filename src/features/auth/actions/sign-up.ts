'use server'

import { headers } from 'next/headers'

import { SITE_URL } from '@/lib/env'
import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

export async function signUp(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(
    credentialsSchema,
    input,
    async (supabase, data) => {
      // Prefer the real request origin so the confirmation link is correct on prod/preview, not pinned to
      // the hosted Site URL (which falls back to localhost). Mirrors reset-password.ts; SITE_URL is the dev fallback.
      const origin = (await headers()).get('origin') ?? SITE_URL
      return supabase.auth.signUp({
        ...data,
        options: { emailRedirectTo: `${origin}/api/auth/confirm?type=email` },
      })
    },
    // Don't reveal whether the email already has an account (user-enumeration). Supabase returns
    // "User already registered" here; collapse every sign-up auth error to one neutral message.
    () => 'Could not create your account. If you already have one, try signing in.',
  )
  if (!result.success) return result

  toastRedirect('/dashboard', 'signed-up')
}
