import { BrandIntroLockup } from '@/components/brand/brand-intro-lockup'

// Only the logo lockup animates (it morphs out of the splash). The copy is plain, static content —
// hidden under the intro veil like every other section and revealed all at once when the veil dissolves.
export function LandingHero() {
  // No overflow-hidden on the section: the morphing logo starts big at viewport-center (outside this
  // section's box) and would get clipped mid-morph — a visible "step" — until it shrinks into the hero.
  return (
    <section className="relative">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 text-center sm:px-8">
        <BrandIntroLockup />
        <h1 className="font-heading max-w-3xl pt-8 text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
          <span className="from-neon-green via-neon-cyan to-neon-fuchsia bg-linear-to-r bg-clip-text text-transparent">
            Wired for recall
          </span>
        </h1>
        <p className="text-muted-foreground mt-6 max-w-xl text-base text-pretty sm:text-lg">
          Keep your coding notes in one place, group them into subjects, and turn them into
          spaced-repetition cards that link straight back to the note they came from.
        </p>
      </div>
    </section>
  )
}
