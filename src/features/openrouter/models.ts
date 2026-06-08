// A model in the picker: the live `/models` catalog normalizes to this; the curated recommended set
// is the same shape sans live pricing (filled at 0). `inputModalities` drives the file/vision filter.
export type OpenRouterModelT = {
  id: string
  label: string
  // Per-token USD (as OpenRouter bills). Multiply by 1e6 for the conventional "/1M tokens" display.
  inputPrice: number
  outputPrice: number
  inputModalities: string[]
}

// Curated short list, pinned as the "Recommended" group on top of the live catalog. All are cheap and
// good at structured extraction. The live `/models` fetch (catalog.ts) supplies the full 300+ list
// below this set; these ids stay first-class so the picker has a sane default even offline.
export const RECOMMENDED_MODELS: { id: string; label: string }[] = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini — cheap, fast' },
  { id: 'openai/gpt-4o', label: 'GPT-4o — stronger' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku — cheap' },
  { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet — stronger' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash — cheap' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
]

export const RECOMMENDED_MODEL_IDS: string[] = RECOMMENDED_MODELS.map((m) => m.id)

// The curated set widened to the full picker shape with unknown (0) pricing and text-only modality.
// Shared by the offline catalog FALLBACK (catalog.ts) and the picker's pre-fetch SEED (model-select.tsx)
// so the two can't drift. Read-only; neither consumer mutates it.
export const RECOMMENDED_FALLBACK: OpenRouterModelT[] = RECOMMENDED_MODELS.map((m) => ({
  ...m,
  inputPrice: 0,
  outputPrice: 0,
  inputModalities: ['text'],
}))

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini'

// Default for the PDF/vision import surface (Phase 8): a cheap, file-capable, dated id (never a
// `*-latest` alias). Gemini Flash reads PDFs well at low cost; the picker still lets the user switch.
export const DEFAULT_OPENROUTER_FILE_MODEL = 'google/gemini-2.0-flash-001'

// Modalities that count as "can read a file" (PDF/image vision) — the Phase 8 import surface filters
// the catalog to these. OpenRouter reports image input as `'image'`; some entries also list `'file'`.
const FILE_MODALITIES = ['image', 'file']

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

// Pure: map the raw `/models` `data[]` to our trimmed shape, dropping entries without a usable id.
// Kept pure (no fetch) so it's unit-testable and so models.ts stays client-importable.
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

// Pure: scope the catalog to a surface. `'file'` keeps only file/vision-capable models (Phase 8 PDF);
// `'text'` keeps everything (every model takes text input).
export function filterModels(
  models: OpenRouterModelT[],
  filter: 'text' | 'file',
): OpenRouterModelT[] {
  if (filter === 'text') return models
  return models.filter((m) => m.inputModalities.some((mod) => FILE_MODALITIES.includes(mod)))
}

// How the picker orders a group: by label, or by either price axis. Direction is orthogonal.
export type ModelSortT = 'name' | 'input' | 'output'
export type SortDirT = 'asc' | 'desc'

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

// Per-token USD → conventional "$X.XX/1M" display.
export function formatPricePerM(price: number): string {
  return `$${(price * 1e6).toFixed(2)}/1M`
}

// Row pricing label. Router models report a negative sentinel (variable pricing) — show that as
// "Variable pricing" rather than a nonsense "$-1000000.00/1M".
export function formatModelPricing(model: OpenRouterModelT): string {
  if (model.inputPrice < 0 || model.outputPrice < 0) return 'Variable pricing'
  return `${formatPricePerM(model.inputPrice)} in · ${formatPricePerM(model.outputPrice)} out`
}
