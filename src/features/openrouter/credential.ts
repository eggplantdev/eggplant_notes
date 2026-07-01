import 'server-only'

import { cache } from 'react'

import { decryptSecret } from '@/lib/crypto/aes-gcm'
import { createClient } from '@/lib/supabase/create-server-client'

type OpenRouterCredentialT = {
  apiKey: string
  model: string | null
}

// The caller's credential row, read once per request. A protected render fans out to several
// readers of this single row — the nav connection gate, the page status (gate + default model),
// and the nav credits badge (which decrypts the key) — so React cache() dedupes them to ONE round
// trip. Selecting the encrypted columns unconditionally is free (same row); they never leave the
// server. RLS scopes the row to the owner. Returns null when not connected.
export const getCredentialRow = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('openrouter_credentials')
    .select('user_id, model, favorite_models, key_ciphertext, key_iv, key_auth_tag')
    .maybeSingle()
  return data
})

// Reads + decrypts the caller's OpenRouter credential (key + persisted default model). The key is
// decrypted server-side and never leaves the server. NOTE: decryptSecret throws on a missing enc
// key or corrupted auth tag — callers that must fail soft (e.g. the nav badge) call this in a
// try/catch.
export async function getOpenRouterCredential(): Promise<OpenRouterCredentialT | null> {
  const data = await getCredentialRow()
  if (!data) return null

  const apiKey = decryptSecret({
    ciphertext: data.key_ciphertext,
    iv: data.key_iv,
    authTag: data.key_auth_tag,
  })
  return { apiKey, model: data.model }
}
