'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'

import { SITE_URL } from '@/lib/env'
import { notifyNewUser } from '@/features/auth/notify-new-user'
import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import type { ActionResultT } from '@/types/action'

export async function signUp(input: unknown): Promise<ActionResultT> {
  // Whether Supabase returns a session decides the post-signup route, and it differs by environment.
  // With email confirmation ON (prod) signUp creates NO session — the user must click the email link
  // first — so we send them to a persistent "check your email" page, not a protected route they'd be
  // bounced from. With it OFF (local) a session exists and they're logged straight into the dashboard.
  // Branching on the response (not a hardcoded env flag) also stays enumeration-safe: with confirmations
  // on, a taken email returns a sessionless success and still lands on check-email, revealing nothing.
  let hasSession = false
  const result = await runAuthAction(
    credentialsSchema,
    input,
    async (supabase, data) => {
      // Prefer the real request origin so the confirmation link is correct on prod/preview, not pinned to
      // the hosted Site URL (which falls back to localhost). Mirrors reset-password.ts; SITE_URL is the dev fallback.
      const origin = (await headers()).get('origin') ?? SITE_URL
      const res = await supabase.auth.signUp({
        ...data,
        options: { emailRedirectTo: `${origin}/api/auth/confirm?type=email` },
      })
      hasSession = Boolean(res.data.session)
      // Notify the operator inbox on a genuinely new sign-up only. With confirmations on, a repeat
      // sign-up for an existing email returns a sessionless success with an EMPTY `identities` array
      // (Supabase's enumeration-safe obfuscation) — guard on it so repeats don't ping the inbox.
      // `after()` runs post-response, so the email never blocks the redirect below.
      const isNewUser = !res.error && (res.data.user?.identities?.length ?? 0) > 0
      if (isNewUser) after(() => notifyNewUser(data.email))
      return res
    },
    // Don't reveal whether the email already has an account (user-enumeration). Supabase returns
    // "User already registered" here; collapse every sign-up auth error to one neutral message.
    () => 'Could not create your account. If you already have one, try signing in.',
  )
  if (!result.success) return result

  // Drop any prior session's client Router Cache in this browser before redirecting (shared-browser
  // safety). Covers both branches; redirect() throws to unwind, so this must run first.
  revalidatePath('/', 'layout')
  // No success toast on the logged-in branch — landing on the dashboard is self-evident, matching
  // sign-in. The other branch's "check your email" instruction lives on the page it redirects to.
  if (hasSession) {
    redirect('/dashboard')
  } else {
    redirect('/sign-up/check-email')
  }
}
