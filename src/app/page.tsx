import { SiteFooter } from '@/components/layout/site-footer'
import { LandingCodePreview } from '@/features/landing/components/landing-code-preview'
import { LandingCta } from '@/features/landing/components/landing-cta'
import { LandingFeatures } from '@/features/landing/components/landing-features'
import { LandingHero } from '@/features/landing/components/landing-hero'
import { LandingIntroProvider } from '@/features/landing/components/landing-intro-provider'
import { LandingNav } from '@/features/landing/components/landing-nav'

// Standalone public marketing page at `/` — outside the auth flow and the (protected) app shell, wrapped
// only by the root layout. The proxy lets `/` through unauthenticated. Sections are server components;
// LandingIntroProvider is a client boundary that wraps them (children stay server-rendered) to drive the
// first-visit splash → hero handoff.
export default function LandingPage() {
  return (
    <LandingIntroProvider>
      <div className="flex min-h-svh flex-col">
        <LandingNav />

        <main className="grid flex-1 content-start gap-32 py-32">
          <LandingHero />
          <LandingFeatures />
          <LandingCodePreview />
          <LandingCta />
        </main>

        <SiteFooter />
      </div>
    </LandingIntroProvider>
  )
}
