'use server'

import { revalidatePath } from 'next/cache'

import { deleteAccountSchema } from '@/features/account/schemas'
import { createClient } from '@/lib/supabase/create-server-client'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Deletes the caller's account via the SECURITY DEFINER `delete_account()` RPC
// (no service-role key); F-02's on-delete-cascade tears down all owned rows.
// Step-up re-auth first: a live session alone must not be enough to destroy the
// account, so we re-verify the current password (guards a hijacked/left-open session).
// On success the session is torn down and we redirect; on failure we return the
// error and DO NOT sign out (the account still exists).
export async function deleteAccount(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(deleteAccountSchema, input)
  if (!parsed.success) return parsed

  const user = await getCurrentUser()
  if (!user?.email) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.password,
  })
  if (reauthError) return { success: false, error: 'Incorrect password' }

  const { error } = await supabase.rpc('delete_account')
  if (error) {
    console.error('delete_account RPC failed:', error)
    return { success: false, error: 'Could not delete your account. Please try again.' }
  }

  // Supabase JWTs are stateless: the access token lives until expiry, so clear
  // the auth cookie now or the user appears signed in against a deleted account.
  // scope: 'local' only clears the cookie — deleting the user already cascaded
  // away every server-side session, so a global revocation round-trip is moot.
  await supabase.auth.signOut({ scope: 'local' })
  // Drop the whole client Router Cache before redirecting — a shared browser must not serve this
  // (now-deleted) user's cached authed pages to whoever signs in next. revalidatePath must precede
  // the redirect; toastRedirect throws to unwind.
  revalidatePath('/', 'layout')
  toastRedirect('/sign-in', 'account-deleted')
}
