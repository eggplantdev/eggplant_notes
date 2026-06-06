'use server'

import { headers } from 'next/headers'

import { SITE_URL } from '@/lib/env'
import { runAuthAction } from '@/features/auth/run-auth-action'
import { resetRequestSchema } from '@/features/auth/schemas'
import type { ActionResultT } from '@/types/action'

export async function resetPassword(input: unknown): Promise<ActionResultT> {
  return runAuthAction(resetRequestSchema, input, async (supabase, data) => {
    // Prefer the real request origin so prod never gets a hardcoded host; SITE_URL fallback is localhost in dev.
    const origin = (await headers()).get('origin') ?? SITE_URL
    return supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/api/auth/confirm?type=recovery`,
    })
  })
}
