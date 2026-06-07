import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

import { VERIFIER_COOKIE } from '@/features/openrouter/pkce'
import { encryptSecret } from '@/lib/crypto/aes-gcm'
import { createClient } from '@/lib/supabase/server'

// OpenRouter OAuth PKCE callback: exchange the returned `code` (+ the verifier we stashed) for the
// user's API key, encrypt it, and upsert the per-user credential. The user is authenticated here
// (the browser carries the Supabase session cookie on the redirect back), so RLS + the user_id
// default scope the upsert to the caller. The decrypted key is never returned to the client.
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code')
  const cookieStore = await cookies()
  const verifier = cookieStore.get(VERIFIER_COOKIE)?.value
  cookieStore.delete(VERIFIER_COOKIE)

  let connected = false
  if (code && verifier) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
      })
      if (res.ok) {
        const { key } = (await res.json()) as { key?: string }
        if (key) {
          const enc = encryptSecret(key)
          const supabase = await createClient()
          const { error } = await supabase
            .from('openrouter_credentials')
            .upsert(
              { key_ciphertext: enc.ciphertext, key_iv: enc.iv, key_auth_tag: enc.authTag },
              { onConflict: 'user_id' },
            )
          connected = !error
        }
      }
    } catch {
      // Network/parse failure falls through to the error redirect rather than 500-ing. redirect()
      // is kept OUT of this try — it throws NEXT_REDIRECT, which must not be swallowed.
    }
  }

  redirect(
    connected
      ? '/settings?toast=openrouter-connected'
      : '/settings?error=Could not connect OpenRouter',
  )
}
