'use server'

import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

// Deletes the caller's account via the SECURITY DEFINER `delete_account()` RPC
// (no service-role key); F-02's on-delete-cascade tears down all owned rows.
// On success the session is torn down and we redirect; on failure we return the
// error and DO NOT sign out (the account still exists).
export async function deleteAccount(): Promise<ActionResultT> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('delete_account')
  if (error) {
    console.error('delete_account RPC failed:', error)
    return { success: false, error: error.message }
  }

  // Supabase JWTs are stateless: the access token lives until expiry, so clear
  // the auth cookie now or the user appears signed in against a deleted account.
  // scope: 'local' only clears the cookie — deleting the user already cascaded
  // away every server-side session, so a global revocation round-trip is moot.
  await supabase.auth.signOut({ scope: 'local' })
  toastRedirect('/sign-in', 'account-deleted')
}
