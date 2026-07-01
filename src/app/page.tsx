import { BrandIntroProvider } from '@/components/brand/brand-intro-provider'
import { SiteFooter } from '@/components/layout/site-footer'
import { LandingCodePreview } from '@/features/landing/components/landing-code-preview'
import { LandingCta } from '@/features/landing/components/landing-cta'
import { LandingFeatures } from '@/features/landing/components/landing-features'
import { LandingHero } from '@/features/landing/components/landing-hero'
import { LandingNav } from '@/features/landing/components/landing-nav'

export default function LandingPage() {
  return (
    <BrandIntroProvider>
      <div className="flex min-h-svh flex-col">
        <LandingNav />

        <main className="grid max-w-screen content-start gap-32 overflow-x-hidden py-32">
          <LandingHero />
          <LandingFeatures />
          <LandingCodePreview />
          <LandingCta />
        </main>

        <SiteFooter />
      </div>
    </BrandIntroProvider>
  )
}
