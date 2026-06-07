import 'server-only'

import { decryptSecret } from '@/lib/crypto/aes-gcm'
import { createClient } from '@/lib/supabase/server'

export type OpenRouterCredentialT = {
  apiKey: string
  model: string | null
}

// Reads + decrypts the caller's OpenRouter credential in ONE row read (key + persisted default model).
// The key is decrypted server-side and never leaves the server; RLS scopes the row to the owner.
// Returns null when not connected. NOTE: decryptSecret throws on a missing enc key or corrupted auth
// tag — callers that must fail soft (e.g. the nav badge) call this inside a try/catch.
export async function getOpenRouterCredential(): Promise<OpenRouterCredentialT | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('openrouter_credentials')
    .select('key_ciphertext, key_iv, key_auth_tag, model')
    .maybeSingle()
  if (!data) return null

  const apiKey = decryptSecret({
    ciphertext: data.key_ciphertext,
    iv: data.key_iv,
    authTag: data.key_auth_tag,
  })
  return { apiKey, model: data.model }
}
