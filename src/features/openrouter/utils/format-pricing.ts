import type { OpenRouterModelT } from '@/features/openrouter/types'

export function formatPricePerM(price: number): string {
  return `$${(price * 1e6).toFixed(2)}/1M`
}

// Row pricing label. Router models report a negative sentinel (variable pricing) — show that as
// "Variable pricing" rather than a nonsense "$-1000000.00/1M". The sentinel is all-or-nothing
// (both axes negative together), so this either-axis check and sortModels' per-axis check agree.
export function formatModelPricing(model: OpenRouterModelT): string {
  if (model.inputPrice < 0 || model.outputPrice < 0) return 'Variable pricing'
  return `${formatPricePerM(model.inputPrice)} in · ${formatPricePerM(model.outputPrice)} out`
}
