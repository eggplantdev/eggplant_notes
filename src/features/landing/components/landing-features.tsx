import { LandingShell } from '@/features/landing/components/landing-shell'
import { FEATURES } from '@/features/landing/landing-features-data'

export function LandingFeatures() {
  return (
    <LandingShell>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, tint, title, body }) => (
          <div
            key={title}
            className="border-border/60 bg-card/50 hover:border-border rounded-xl border p-5 transition-colors"
          >
            <div className={`flex items-center gap-4`}>
              <Icon className={`size-5 ${tint}`} />
              <h3 className="font-heading text-base leading-none font-medium">{title}</h3>
            </div>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </LandingShell>
  )
}
