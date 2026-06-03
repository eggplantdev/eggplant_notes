import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/actions/sign-out'
import { createClient } from '@/lib/supabase/server'

// Minimal authenticated landing target to prove gating end-to-end (real dashboard is S-04).
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-start justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {user?.email}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/settings">Settings</Link>
        </Button>
        <form action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      </div>
    </main>
  )
}
