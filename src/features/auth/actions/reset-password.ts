'use server'

import { headers } from 'next/headers'

import { SITE_URL } from '@/lib/env'
import { runAuthAction } from '@/features/auth/run-auth-action'
import { resetRequestSchema } from '@/features/auth/schema'
import type { ActionResultT } from '@/types/action'

export async function resetPassword(input: unknown): Promise<ActionResultT> {
  return runAuthAction(resetRequestSchema, input, async (supabase, data) => {
    // Prefer the real request origin; fall back to the configured site URL
    // (SITE_URL itself defaults to localhost for dev) — never a hardcoded host on prod.
    const origin = (await headers()).get('origin') ?? SITE_URL
    return supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/api/auth/confirm?type=recovery`,
    })
  })
}
