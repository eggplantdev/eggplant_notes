import Link from 'next/link'

import { BrandMark } from '@/components/brand/brand-mark'
import { Button } from '@/components/ui/button'
import { LandingShell } from '@/features/landing/components/landing-shell'

// Sticky header for the public landing page. Reuses the app's header-fade pattern (no solid bar/border;
// content scrolls under the fade). pointer-events-none on the header + auto on the nav so the transparent
// tail stays clickable.
export function LandingNav() {
  return (
    <header className="header-fade pointer-events-none sticky top-0 z-40">
      <LandingShell as="nav" className="pointer-events-auto flex items-center justify-between py-4">
        <BrandMark href="/" size="sm" wordmarkClassName="hidden sm:flex" />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="ai" size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </LandingShell>
    </header>
  )
}
