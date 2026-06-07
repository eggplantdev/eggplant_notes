import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/models'
import { decryptSecret } from '@/lib/crypto/aes-gcm'
import { SITE_URL } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

// Returns a language model bound to the CALLER's decrypted OpenRouter key, or null if not connected.
// The key is decrypted server-side here and never leaves the server; RLS guarantees the selected row
// is the caller's own. Consumed by the Phase 3-4 generation actions (generateObject).
export async function getOpenRouterModel() {
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
  const openrouter = createOpenRouter({
    apiKey,
    appName: 'coding-learning-companion',
    appUrl: SITE_URL,
  })
  return openrouter(data.model ?? DEFAULT_OPENROUTER_MODEL)
}
