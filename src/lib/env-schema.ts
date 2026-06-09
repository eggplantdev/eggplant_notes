import { z } from 'zod'

// Plain schema source — no side effects, no `import 'server-only'`. This is the one module both
// the client/server env entries AND next.config.ts can import: next.config validates the server
// vars via `serverSchema.parse(process.env)` at build start without ever touching the server-only
// `env.server.ts` module (which is unresolvable outside Next's app compilation).
//
// Var names mirror the portfolio repo so existing SMTP values copy over 1:1. The sender/from
// address is public there (`NEXT_PUBLIC_EMAIL_USER`); only host/pass/to are secret.

// z.url() (like new URL()) silently normalizes an http(s) scheme missing its `//` authority
// separator — 'https:host' parses as protocol 'https:' + path 'host' and passes. The malformed
// value then breaks when emitted as a raw href/redirect (a baked 'https:host' reset link resolves
// relative to the mail client's domain → 404). These are all http(s) deployment URLs, so require
// the literal '//'. Regression caught in the portfolio repo's NEXT_PUBLIC_FRONTEND_URL.
const httpUrl = z
  .url()
  .refine((s) => /^https?:\/\//i.test(s), 'URL must include the // authority separator')

export const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: httpUrl.default('http://127.0.0.1:3000'),
  NEXT_PUBLIC_EMAIL_USER: z.email(),
})

export const serverSchema = z.object({
  EMAIL_HOST: z.string().min(1),
  EMAIL_PASS: z.string().min(1),
  EMAIL_TO: z.email(),
})
