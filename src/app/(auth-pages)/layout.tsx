import type { ReactNode } from 'react'

import { AuthBrandMark } from '@/features/auth/components/auth-brand-mark'
import { getCurrentUser } from '@/lib/supabase/server'

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const authed = Boolean(await getCurrentUser())
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="grid w-full max-w-sm gap-8">
        <AuthBrandMark
          authed={authed}
          size="lg"
          aria-label="eggplant_notes — home"
          className="justify-center gap-1 focus-visible:outline-none"
        />
        {children}
      </div>
    </main>
  )
}
