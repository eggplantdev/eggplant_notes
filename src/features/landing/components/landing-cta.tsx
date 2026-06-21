import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { LandingShell } from '@/features/landing/components/landing-shell'

export function LandingCta() {
  return (
    <LandingShell className="flex justify-center">
      <Button asChild variant="ai" size="lg" className="h-14 px-8 text-lg">
        <Link href="/sign-up">Get started</Link>
      </Button>
    </LandingShell>
  )
}
