import type { LucideIcon } from 'lucide-react'
import { Layers, RefreshCw, Smartphone, Sparkles, Terminal } from 'lucide-react'

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
    tint: 'text-neon-fuchsia',
    title: 'CLI & agent API',
    body: 'Drive everything from your terminal or coding agent over a token-authenticated API. Download a ready-made agent skill and go.',
  },
  {
    icon: Smartphone,
    tint: 'text-neon-cyan',
    title: 'Install as an app',
    body: 'Add it to your home screen and launch it like a native app, signed in and ready.',
  },
]

// A hand-coloured snippet for the code-preview card — no client highlighter on the marketing page.
// Each token is [text, kind]; '' = inherit the base colour. Kinds map to the brand neon ramp in TOKEN_COLOR.
export const CODE_LINES = [
  [['// Remove duplicates, keep first occurrence', 'com']],
  [
    ['export function ', 'kw'],
    ['unique', 'fn'],
    ['(items: ', ''],
    ['string', 'fn'],
    ['[]) {', ''],
  ],
  [
    ['  ', ''],
    ['return ', 'kw'],
    ['[...', ''],
    ['new ', 'kw'],
    ['Set', 'fn'],
    ['(items)]', ''],
  ],
  [['}', '']],
  [
    ['unique', 'fn'],
    ['([', ''],
    ['"a"', 'str'],
    [', ', ''],
    ['"b"', 'str'],
    [', ', ''],
    ['"a"', 'str'],
    ['])  ', ''],
    ['// result: ["a", "b"]', 'com'],
  ],
] as const

export const TOKEN_COLOR: Record<string, string> = {
  kw: 'text-neon-fuchsia',
  fn: 'text-neon-cyan',
  str: 'text-neon-green',
  com: 'text-muted-foreground italic',
}
