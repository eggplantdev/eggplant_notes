// Relative (not `@/`) on purpose: this module is loaded by next.config.ts via jiti, which doesn't
// resolve the tsconfig path alias. Sibling import keeps it portable with zero jiti alias config.
import { clientSchema } from './env-schema'

// Client/public env entry — safe to import from anywhere (browser bundle included). Validated
// eagerly at module load; a missing/malformed var throws here. Imported by next.config.ts (via
// jiti) so that throw happens at BUILD start, not just at runtime.
//
// Each NEXT_PUBLIC_* must be read by a STATIC `process.env.NEXT_PUBLIC_X` key — Next.js only inlines
// statically-written references into the client bundle; a wholesale `process.env` spread leaves them
// undefined in the browser. Server-only vars live in `env.server.ts` (never here — this file reaches
// the client).
const env = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_EMAIL_USER: process.env.NEXT_PUBLIC_EMAIL_USER,
})

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL
// Public sender/from address — not a secret, so it lives client-side (mirrors portfolio). The
// contact action reads it from here; host/pass/to come from the server-only env.server.ts.
export const EMAIL_USER = env.NEXT_PUBLIC_EMAIL_USER
