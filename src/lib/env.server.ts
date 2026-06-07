import 'server-only'

// Relative sibling import to match env.ts and keep the env layer's internal wiring alias-free.
import { serverSchema } from './env-schema'

// Server-only env entry. `import 'server-only'` makes `next build` FAIL if any client component
// imports this module — that build-time error is the guarantee that SMTP secrets can never reach
// the browser bundle. Eager parse is safe here precisely because this module is never bundled
// client-side. next.config.ts does NOT import this file (server-only is unresolvable outside Next's
// app compilation); it validates the same vars via serverSchema directly.
export const serverEnv = serverSchema.parse(process.env)
