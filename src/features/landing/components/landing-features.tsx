import { FEATURES } from '@/features/landing/landing-data'

export function LandingFeatures() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, tint, title, body }) => (
          <div
            key={title}
            className="border-border/60 bg-card/50 hover:border-border rounded-xl border p-5 transition-colors"
          >
            <Icon className={`size-5 ${tint}`} />
            <h3 className="font-heading mt-4 text-base font-medium">{title}</h3>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
