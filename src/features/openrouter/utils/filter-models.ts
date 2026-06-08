import type { OpenRouterModelT } from '@/features/openrouter/types'

// Modalities that count as "can read a file" (PDF/image vision) — the Phase 8 import surface filters
// the catalog to these. OpenRouter reports image input as `'image'`; some entries also list `'file'`.
const FILE_MODALITIES = ['image', 'file']

// Pure: scope the catalog to a surface. `'file'` keeps only file/vision-capable models (Phase 8 PDF);
// `'text'` keeps everything (every model takes text input).
export function filterModels(
  models: OpenRouterModelT[],
  filter: 'text' | 'file',
): OpenRouterModelT[] {
  if (filter === 'text') return models
  return models.filter((m) => m.inputModalities.some((mod) => FILE_MODALITIES.includes(mod)))
}
