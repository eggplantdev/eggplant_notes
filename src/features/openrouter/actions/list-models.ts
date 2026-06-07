'use server'

import { getModelCatalog } from '@/features/openrouter/catalog'
import type { OpenRouterModelT } from '@/features/openrouter/models'

// Read-only bridge so the client picker (model-select.tsx) can pull the server-cached `/models`
// catalog on demand (popover-open) without a server-only import. No mutation — just exposes the cache.
export async function listOpenRouterModels(): Promise<OpenRouterModelT[]> {
  return getModelCatalog()
}
