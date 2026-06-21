import 'server-only'

import { serverSchema } from './env-schema'

// Server-only env entry. `import 'server-only'` makes `next build` FAIL if any client component
// imports this module — that build-time error is the guarantee that SMTP secrets can never reach
// the browser bundle. Eager parse is safe here precisely because this module is never bundled
// client-side. The root layout (src/app/layout.tsx) imports it so the parse runs at BUILD start.
export const serverEnv = serverSchema.parse(process.env)
