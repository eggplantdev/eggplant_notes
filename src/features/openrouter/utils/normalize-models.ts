import type { OpenRouterModelT } from '@/features/openrouter/types'

// Shape of one entry in the OpenRouter `/models` payload we actually read. Everything is optional/loose
// because it's an external API — `normalizeModels` defends against missing fields rather than trusting it.
type RawModelT = {
  id?: unknown
  name?: unknown
  pricing?: { prompt?: unknown; completion?: unknown }
  architecture?: { input_modalities?: unknown }
}

function toPrice(value: unknown): number {
  const n = parseFloat(String(value))
  return Number.isFinite(n) ? n : 0
}

// Pure (no fetch) — unit-testable and client-importable.
export function normalizeModels(data: RawModelT[]): OpenRouterModelT[] {
  return data
    .filter((m): m is RawModelT & { id: string } => typeof m.id === 'string' && m.id.length > 0)
    .map((m) => ({
      id: m.id,
      label: typeof m.name === 'string' && m.name.length > 0 ? m.name : m.id,
      inputPrice: toPrice(m.pricing?.prompt),
      outputPrice: toPrice(m.pricing?.completion),
      inputModalities: Array.isArray(m.architecture?.input_modalities)
        ? m.architecture.input_modalities.filter((x): x is string => typeof x === 'string')
        : ['text'],
    }))
}
