import type { LucideIcon } from 'lucide-react'
import { Layers, RefreshCw, Rocket, Smartphone, Sparkles, Terminal } from 'lucide-react'

export type FeatureT = {
  icon: LucideIcon
  // A `text-neon-*` utility — the brand ramp hue for this card's icon.
  tint: string
  title: string
  body: string
}

export const FEATURES: readonly FeatureT[] = [
  {
    icon: Layers,
    tint: 'text-neon-green',
    title: 'Subjects & notes',
    body: 'Group your notes into subjects and read a whole subject as one continuous document — not scattered files across repos.',
  },
  {
    icon: RefreshCw,
    tint: 'text-neon-cyan',
    title: 'Spaced-repetition recall',
    body: 'Turn any note into memory cards that resurface right before you forget. Every card links back to the note it came from.',
  },
  {
    icon: Sparkles,
    tint: 'text-neon-violet',
    title: 'AI',
    body: 'Generate notes and cards with your own OpenRouter key.',
  },
  {
    icon: Terminal,
    tint: 'text-neon-green',
    title: 'CLI & agent API',
    body: 'Drive everything from your terminal or coding agent over a token-authenticated API. Download a ready-made agent skill and go.',
  },
  {
    icon: Smartphone,
    tint: 'text-neon-cyan',
    title: 'Install as an app',
    body: 'Add it to your home screen and launch it like a native app, signed in and ready.',
  },
  {
    icon: Rocket,
    tint: 'text-neon-violet',
    title: 'More coming soon',
    body: "We're just getting started — more ways to capture, recall, and learn are on the way.",
  },
]
