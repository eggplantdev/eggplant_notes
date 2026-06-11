'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  // Clear this user's cached authed pages so the next user in a shared browser can't see them.
  // Before redirect — redirect() throws to unwind.
  revalidatePath('/', 'layout')
  redirect('/sign-in')
}
