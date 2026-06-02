import { z } from 'zod'

// Single source for every process.env var the app reads. Two rules baked in:
// 1. Access each NEXT_PUBLIC_* var by a STATIC `process.env.NEXT_PUBLIC_X` key below —
//    Next.js only inlines statically-written references into the client bundle. Parsing
//    `process.env` wholesale would leave these undefined in the browser.
// 2. Validate the assembled object (not process.env) so a missing/malformed var fails
//    loudly at module load instead of surfacing as a confusing runtime error later.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://127.0.0.1:3000'),
})

const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL
