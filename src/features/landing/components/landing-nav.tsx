import Link from 'next/link'

import { BrandMark } from '@/components/brand/brand-mark'
import { Button } from '@/components/ui/button'

// Sticky header for the public landing page. Reuses the app's header-fade pattern (no solid bar/border;
// content scrolls under the fade). pointer-events-none on the header + auto on the nav so the transparent
// tail stays clickable.
export function LandingNav() {
  return (
    <header className="header-fade pointer-events-none sticky top-0 z-40">
      <nav className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <BrandMark href="/" size="sm" wordmarkClassName="" />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="ai" size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
