import { AnimatedBrandLogo } from '@/components/brand/animated-brand-logo'

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 text-center sm:px-8">
        <AnimatedBrandLogo className="size-20 sm:size-24" />
        <h1 className="font-heading mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Your notes,{' '}
          <span className="from-neon-green via-neon-cyan to-neon-fuchsia bg-linear-to-r bg-clip-text text-transparent">
            wired for recall
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
