import { Code2 } from 'lucide-react'

import { CODE_LINES, TOKEN_COLOR } from '@/features/landing/landing-code-preview-data'

export function LandingCodePreview() {
  return (
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
            code, not a grey wall of text.
          </p>
        </div>
        <div className="border-border/60 bg-card overflow-hidden rounded-xl border shadow-lg">
          <div className="border-border/60 bg-muted/30 flex items-center gap-2 border-b px-5 py-3">
            <span className="text-muted-foreground ml-2 font-mono text-xs">unique.ts</span>
          </div>
          <pre className="overflow-x-auto px-5 py-5 text-sm leading-relaxed sm:text-base">
            {/* ligatures off: Geist Mono renders the spread `[...` as a mangled `.[.` via a contextual
                alternate — disable them so code reads literally (correct for a code block regardless). */}
            <code className="text-foreground/90 font-mono [font-variant-ligatures:none]">
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
  )
}
