import 'server-only'

import { unstable_cache } from 'next/cache'

import { RECOMMENDED_FALLBACK } from '@/features/openrouter/constants'
import type { OpenRouterModelT } from '@/features/openrouter/types'
import { normalizeModels } from '@/features/openrouter/utils/normalize-models'

const MODELS_URL = 'https://openrouter.ai/api/v1/models'

// If the live fetch fails (network, OpenRouter down), fall back to the curated set so the picker still
// works and the allowlist still accepts the recommended ids. Prices unknown offline → 0 (hidden in UI).
const FALLBACK = RECOMMENDED_FALLBACK

// Uncached fetch+normalize — exported so it can be unit-tested against a mocked `fetch`. The public
// entry point is the cached `getModelCatalog` below.
export async function fetchModelCatalog(): Promise<OpenRouterModelT[]> {
  try {
    const res = await fetch(MODELS_URL)
    if (!res.ok) return FALLBACK
    const json = (await res.json()) as { data?: unknown }
    const models = Array.isArray(json.data) ? normalizeModels(json.data) : []
    return models.length > 0 ? models : FALLBACK
  } catch {
    return FALLBACK
  }
}

// The `/models` catalog is public, free, and the same for every user, so cache it process-wide and
// revalidate ~daily — every picker reads a current list with no per-render network cost.
export const getModelCatalog = unstable_cache(fetchModelCatalog, ['openrouter-model-catalog'], {
  revalidate: 86400,
})

// Allowlist guard for ids reaching OpenRouter (per-generate override + the settings write). Membership
// over the live catalog, not the static six — keeps off-list ids out while honoring the full catalog.
export async function isAllowedModel(id: string): Promise<boolean> {
  const catalog = await getModelCatalog()
  return catalog.some((m) => m.id === id)
}
