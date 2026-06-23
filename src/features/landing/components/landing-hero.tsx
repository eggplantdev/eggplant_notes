import { BrandIntroLockup } from '@/components/brand/brand-intro-lockup'
import { LandingShell } from '@/features/landing/components/landing-shell'

// Only the logo lockup animates (it morphs out of the splash). The copy is plain, static content —
// hidden under the intro veil like every other section and revealed all at once when the veil dissolves.
export function LandingHero() {
  // No overflow-hidden on the section: the morphing logo starts big at viewport-center (outside this
  // section's box) and would get clipped mid-morph — a visible "step" — until it shrinks into the hero.
  return (
    <section className="relative">
      <LandingShell as="div" className="flex flex-col items-center gap-6 text-center">
        <BrandIntroLockup />
        <h1 className="font-heading max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
          <span className="from-neon-green via-neon-cyan to-neon-fuchsia bg-linear-to-r bg-clip-text text-transparent">
            Wired for recall
          </span>
        </h1>
        <p className="text-muted-foreground max-w-xl text-base text-pretty sm:text-lg">
          Keep your notes in one place, group them into subjects, and turn them into
          spaced-repetition cards. Integrate seamlessly into your daily AI workflow.
        </p>
      </LandingShell>
    </section>
  )
}
