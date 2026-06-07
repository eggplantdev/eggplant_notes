import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { isAllowedModel } from '@/features/openrouter/catalog'
import { getOpenRouterCredential } from '@/features/openrouter/credential'
import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/models'
import { SITE_URL } from '@/lib/env'

// Resolution order: per-generate override > settings default (credential.model) > hard default. The
// override is validated against the live catalog (off-list ids are ignored, not trusted). Returns
// `{ model, modelId }` so callers can log/return the id actually used.
async function resolveModelId(
  override: string | undefined,
  stored: string | null,
): Promise<string> {
  if (override && (await isAllowedModel(override))) return override
  return stored ?? DEFAULT_OPENROUTER_MODEL
}

// Returns a language model bound to the CALLER's decrypted OpenRouter key (plus the resolved model
// id), or null if not connected. The key is decrypted server-side here and never leaves the server;
// RLS guarantees the selected row is the caller's own. Consumed by the generation actions.
export async function getOpenRouterModel(overrideModelId?: string) {
  const credential = await getOpenRouterCredential()
  if (!credential) return null

  const openrouter = createOpenRouter({
    apiKey: credential.apiKey,
    appName: 'coding-learning-companion',
    appUrl: SITE_URL,
  })
  const modelId = await resolveModelId(overrideModelId, credential.model)
  return { model: openrouter(modelId), modelId }
}
