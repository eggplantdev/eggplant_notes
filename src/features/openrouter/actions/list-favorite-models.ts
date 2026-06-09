'use server'

import { getCredentialRow } from '@/features/openrouter/credential'

// Read-only bridge so the client picker (model-select.tsx) can pull the caller's starred model ids
// on popover-open, mirroring list-models.ts for the catalog. Returns [] when not connected.
export async function listFavoriteModels(): Promise<string[]> {
  const data = await getCredentialRow()
  return data?.favorite_models ?? []
}
