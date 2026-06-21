import Link from 'next/link'
import { Code2, Layers, RefreshCw, Smartphone, Sparkles, Terminal } from 'lucide-react'

import { AnimatedBrandLogo } from '@/components/brand/animated-brand-logo'
import { BrandMark } from '@/components/brand/brand-mark'
import { SiteFooter } from '@/components/layout/site-footer'
import { Button } from '@/components/ui/button'

// Standalone public marketing page at `/` — outside the auth flow and the (protected) app shell, wrapped
// only by the root layout. Server component (no interactivity); the proxy lets `/` through unauthenticated.

const FEATURES = [
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
] as const

// A hand-coloured snippet for the code-preview card — no client highlighter on the marketing page.
// Each token is [text, kind]; '' = inherit the base colour. Kinds map to the brand neon ramp below.
const CODE_LINES = [
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

const TOKEN_COLOR: Record<string, string> = {
  kw: 'text-neon-fuchsia',
  fn: 'text-neon-cyan',
  str: 'text-neon-green',
  com: 'text-muted-foreground italic',
}

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Nav — the app's header gradient-fade pattern (sticky, no solid bar/border; content scrolls under
          the fade). pointer-events-none on the header + auto on the nav so the transparent tail stays clickable. */}
      <header className="header-fade pointer-events-none sticky top-0 z-40">
        <nav className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <BrandMark href="/" size="sm" />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="grid flex-1 content-start gap-32 py-32">
        {/* Hero */}
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

        {/* Features */}
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

        {/* Code preview */}
        <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-8">
            <div className="text-center">
              <p className="text-neon-cyan inline-flex items-center gap-1.5 font-mono text-xs">
                <Code2 className="size-4" />
                Built for code
              </p>
              <h2 className="font-heading mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Your code, in full color
              </h2>
              <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed sm:text-base">
                Notes and cards render code with real syntax highlighting — so a snippet reads like
                code, not a grey wall of text. Paste it, review it, recall it.
              </p>
            </div>
            <div className="border-border/60 bg-card overflow-hidden rounded-xl border shadow-lg">
              <div className="border-border/60 bg-muted/30 flex items-center gap-2 border-b px-5 py-3">
                <span className="text-muted-foreground ml-2 font-mono text-xs">unique.ts</span>
              </div>
              <pre className="overflow-x-auto px-5 py-5 text-sm leading-relaxed sm:text-base">
                <code className="text-foreground/90 font-mono">
                  {CODE_LINES.map((line, i) => (
                    <span key={i} className="block">
                      {line.map(([text, kind], j) => (
                        <span key={j} className={TOKEN_COLOR[kind] ?? ''}>
                          {text}
                        </span>
                      ))}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="sm:px mx-auto flex w-full max-w-6xl justify-center px-5">
          <Button asChild size="lg" className="h-11 px-6 text-base">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
