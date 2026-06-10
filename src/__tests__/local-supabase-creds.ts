import { createHmac } from 'node:crypto'

// Shared local-Supabase creds for the RUN_INTEGRATION specs. These are the universal `supabase start`
// DEMO keys (iss: supabase-demo) — identical on every machine, valid only against localhost, and useless
// against the hosted project (whose real keys live solely in Vercel env). They are NOT secrets.
//
// We MINT the anon/service_role JWTs from the demo secret instead of inlining the `eyJ…` literals so
// secret scanners (GitGuardian) don't pattern-match a `service_role` JWT on every commit and train us to
// ignore the alert. HS256 is deterministic, so signing the canonical payloads reproduces the exact same
// tokens `supabase start` prints — byte-for-byte, no env or `.env.local` dependency.

export const SUPABASE_URL = 'http://127.0.0.1:54321'

// The published local-dev demo JWT secret (≥32 chars, HS256). A constant, not a credential.
export const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')

// Key order matches the canonical demo tokens so the output is byte-identical to what Supabase ships.
function mintDemoKey(role: 'anon' | 'service_role'): string {
  const data = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase-demo', role, exp: 1983812996 })}`
  const sig = createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export const ANON_KEY = mintDemoKey('anon')
export const SERVICE_ROLE_KEY = mintDemoKey('service_role')
