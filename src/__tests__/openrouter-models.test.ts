import { describe, expect, it } from 'vitest'

import type { OpenRouterModelT } from '@/features/openrouter/types'
import { filterModels } from '@/features/openrouter/utils/filter-models'
import { formatModelPricing, formatPricePerM } from '@/features/openrouter/utils/format-pricing'
import { normalizeModels } from '@/features/openrouter/utils/normalize-models'
import { sortModels } from '@/features/openrouter/utils/sort-models'

describe('normalizeModels', () => {
  it('maps the raw /models shape to the trimmed picker shape', () => {
    const raw = [
      {
        id: 'openai/gpt-4o',
        name: 'OpenAI: GPT-4o',
        pricing: { prompt: '0.0000025', completion: '0.00001' },
        architecture: { input_modalities: ['text', 'image'] },
      },
    ]
    expect(normalizeModels(raw)).toEqual([
      {
        id: 'openai/gpt-4o',
        label: 'OpenAI: GPT-4o',
        inputPrice: 0.0000025,
        outputPrice: 0.00001,
        inputModalities: ['text', 'image'],
      },
    ])
  })

  it('drops entries without a usable id', () => {
    const raw = [{ name: 'no id' }, { id: '', name: 'empty id' }, { id: 'a/b', name: 'ok' }]
    expect(normalizeModels(raw).map((m) => m.id)).toEqual(['a/b'])
  })

  it('falls back label→id and defaults missing prices/modalities defensively', () => {
    expect(normalizeModels([{ id: 'x/y' }])).toEqual([
      { id: 'x/y', label: 'x/y', inputPrice: 0, outputPrice: 0, inputModalities: ['text'] },
    ])
  })

  it('coerces non-numeric prices to 0', () => {
    const raw = [{ id: 'a/b', pricing: { prompt: 'free', completion: undefined } }]
    const [m] = normalizeModels(raw)
    expect([m.inputPrice, m.outputPrice]).toEqual([0, 0])
  })
})

describe('filterModels', () => {
  const models = normalizeModels([
    { id: 'text/only', architecture: { input_modalities: ['text'] } },
    { id: 'vision/img', architecture: { input_modalities: ['text', 'image'] } },
    { id: 'vision/file', architecture: { input_modalities: ['file'] } },
  ])

  it("'text' returns the whole list", () => {
    expect(filterModels(models, 'text')).toHaveLength(3)
  })

  it("'file' keeps only image/file-capable models", () => {
    expect(filterModels(models, 'file').map((m) => m.id)).toEqual(['vision/img', 'vision/file'])
  })
})

describe('sortModels', () => {
  const model = (
    id: string,
    label: string,
    inputPrice: number,
    outputPrice: number,
  ): OpenRouterModelT => ({ id, label, inputPrice, outputPrice, inputModalities: ['text'] })

  // Intentionally out of every target order so each sort has to do real work.
  const models: OpenRouterModelT[] = [
    model('c', 'Charlie', 0.003, 0.001),
    model('a', 'Alpha', 0.001, 0.009),
    model('b', 'Bravo', 0.002, 0.005),
  ]

  it("'name' orders by label A→Z", () => {
    expect(sortModels(models, 'name').map((m) => m.label)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it("'input' orders by ascending input price", () => {
    expect(sortModels(models, 'input').map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it("'output' orders by ascending output price", () => {
    expect(sortModels(models, 'output').map((m) => m.id)).toEqual(['c', 'b', 'a'])
  })

  it('breaks equal-price ties by label', () => {
    const tied: OpenRouterModelT[] = [
      model('z', 'Zeta', 0.005, 0.005),
      model('m', 'Mu', 0.005, 0.005),
    ]
    expect(sortModels(tied, 'input').map((m) => m.label)).toEqual(['Mu', 'Zeta'])
    expect(sortModels(tied, 'output').map((m) => m.label)).toEqual(['Mu', 'Zeta'])
  })

  it('does not mutate the source array', () => {
    const original = [...models]
    sortModels(models, 'input')
    expect(models).toEqual(original)
  })

  it("'name' descending reverses to Z→A", () => {
    expect(sortModels(models, 'name', 'desc').map((m) => m.label)).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ])
  })

  it("'input' descending orders priciest first", () => {
    expect(sortModels(models, 'input', 'desc').map((m) => m.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts negative (variable) prices last in both directions', () => {
    const withVariable: OpenRouterModelT[] = [
      model('router', 'Router', -1, -1),
      model('cheap', 'Cheap', 0.001, 0.001),
      model('pricey', 'Pricey', 0.009, 0.009),
    ]
    expect(sortModels(withVariable, 'input', 'asc').map((m) => m.id)).toEqual([
      'cheap',
      'pricey',
      'router',
    ])
    expect(sortModels(withVariable, 'input', 'desc').map((m) => m.id)).toEqual([
      'pricey',
      'cheap',
      'router',
    ])
  })
})

describe('formatModelPricing', () => {
  const withPrices = (inputPrice: number, outputPrice: number): OpenRouterModelT => ({
    id: 'x/y',
    label: 'X',
    inputPrice,
    outputPrice,
    inputModalities: ['text'],
  })

  it('shows the in/out pair for normal prices', () => {
    expect(formatModelPricing(withPrices(0.0000025, 0.00001))).toBe('$2.50/1M in · $10.00/1M out')
  })

  it('shows "Variable pricing" when either price is the negative sentinel', () => {
    expect(formatModelPricing(withPrices(-1, -1))).toBe('Variable pricing')
    expect(formatModelPricing(withPrices(0.001, -1))).toBe('Variable pricing')
  })
})

describe('formatPricePerM', () => {
  it('renders per-token USD as a per-1M-token price', () => {
    expect(formatPricePerM(0.0000025)).toBe('$2.50/1M')
    expect(formatPricePerM(0)).toBe('$0.00/1M')
  })
})
