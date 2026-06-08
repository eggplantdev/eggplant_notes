import type { ModelSortT, OpenRouterModelT, SortDirT } from '@/features/openrouter/types'

// Pure: order a model list by a field + direction, with a label tie-break so equal values stay
// deterministic. Router/dynamic-priced models report a NEGATIVE sentinel price — treat that as
// "unknown" and always sort it last (it's neither cheapest nor priciest), regardless of direction.
// Returns a new array — the caller's source is untouched.
export function sortModels(
  models: OpenRouterModelT[],
  sort: ModelSortT,
  dir: SortDirT = 'asc',
): OpenRouterModelT[] {
  const byLabel = (a: OpenRouterModelT, b: OpenRouterModelT) => a.label.localeCompare(b.label)
  const mul = dir === 'asc' ? 1 : -1
  return [...models].sort((a, b) => {
    if (sort === 'name') return mul * byLabel(a, b)
    const pa = sort === 'input' ? a.inputPrice : a.outputPrice
    const pb = sort === 'input' ? b.inputPrice : b.outputPrice
    const unknownA = pa < 0
    const unknownB = pb < 0
    if (unknownA || unknownB) {
      if (unknownA && unknownB) return byLabel(a, b)
      return unknownA ? 1 : -1
    }
    return mul * (pa - pb) || byLabel(a, b)
  })
}
