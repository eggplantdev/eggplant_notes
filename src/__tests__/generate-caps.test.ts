import { beforeEach, describe, expect, it, vi } from 'vitest'

// R4 (test-plan §2): a generation request must REFUSE input past its per-request size ceiling, and
// the refusal must short-circuit BEFORE the model is called — an over-limit request must consume
// zero tokens. We mock the heavy deps (server-only chain, Supabase queries, the AI SDK) so the real
// `sourceSchema` runs through the real action entry; the over-limit path returns from
// `validateInput` before any mock is touched, so this asserts the cap, not the mocks.
//
// Scope boundary: this covers the PER-REQUEST cap only. The "cannot be looped to bypass it" half of
// R4 has NO guard in code (BYOK-mitigated — a loop burns the user's own OpenRouter credits), so
// there is nothing to assert there. Do not read a passing suite as "R4 fully closed".
vi.mock('server-only', () => ({}))
vi.mock('@/features/openrouter/server-client', () => ({ getOpenRouterModel: vi.fn() }))
vi.mock('@/features/openrouter/queries', () => ({ getResolvedSystemPrompts: vi.fn() }))
vi.mock('@/features/notes/queries', () => ({ getNote: vi.fn() }))
vi.mock('@/lib/ai-debug/log-generation', () => ({ logGeneration: vi.fn() }))
vi.mock('ai', () => ({ generateObject: vi.fn() }))

import { generateObject } from 'ai'

import { generateCards } from '@/features/openrouter/actions/generate-cards'
import { generateNotes } from '@/features/openrouter/actions/generate-notes'
import { getResolvedSystemPrompts } from '@/features/openrouter/queries'
import { getOpenRouterModel } from '@/features/openrouter/server-client'

const generateObjectMock = vi.mocked(generateObject)
const getOpenRouterModelMock = vi.mocked(getOpenRouterModel)
const getResolvedSystemPromptsMock = vi.mocked(getResolvedSystemPrompts)

// The per-request caps under test (mirrors the Zod `.max()` values in the actions).
const TEXT_CAP = 50_000
const TOPIC_CAP = 200

beforeEach(() => {
  vi.clearAllMocks()
  // Baseline: every dependency is wired so a within-cap request WOULD reach and succeed at the
  // model. This is what makes the over-limit assertions mutation-proof — if the cap were removed,
  // the request would sail through to `generateObject`, so `not.toHaveBeenCalled()` would fail.
  // The cap is then the only thing that can short-circuit before the model.
  getOpenRouterModelMock.mockResolvedValue({ model: {} as never, modelId: 'test-model' })
  getResolvedSystemPromptsMock.mockResolvedValue({
    notes_decompose: 'sys',
    notes_topic: 'sys',
    cards: 'sys',
  })
  generateObjectMock.mockResolvedValue({
    object: {
      notes: [{ title: 'Title', content: 'Body' }],
      cards: [{ prompt: 'Q', example: 'A' }],
    },
    usage: { totalTokens: 1 },
  } as never)
})

describe('generateNotes — per-request size cap (R4)', () => {
  it('refuses pasted text over the 50k cap without calling the model', async () => {
    const result = await generateNotes({ text: 'x'.repeat(TEXT_CAP + 1) })

    expect(result.success).toBe(false)
    // The cap fires inside a z.union, so the surfaced message is Zod's flattened union message — we
    // assert the REFUSAL (the effect that matters), not the exact wording (brittle union internals).
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('refuses a topic over the 200-char cap without calling the model', async () => {
    const result = await generateNotes({ topic: 'x'.repeat(TOPIC_CAP + 1) })

    expect(result.success).toBe(false)
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('refuses a PDF over the 10 MB cap without calling the model', async () => {
    // MAX_PDF_BASE64_CHARS = ceil(10 MB / 3) * 4; one char past it must reject.
    const overLimitBase64 = 'A'.repeat(Math.ceil((10 * 1024 * 1024) / 3) * 4 + 1)
    const result = await generateNotes({
      file: { dataBase64: overLimitBase64, mediaType: 'application/pdf' },
    })

    expect(result.success).toBe(false)
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('accepts text AT the cap and reaches the model (proves the cap gates, not a blanket deny)', async () => {
    const result = await generateNotes({ text: 'x'.repeat(TEXT_CAP) })

    expect(result.success).toBe(true)
    expect(generateObjectMock).toHaveBeenCalledOnce()
  })
})

describe('generateCards — per-request size cap (R4)', () => {
  it('refuses a topic over the 200-char cap without calling the model', async () => {
    const result = await generateCards({ topic: 'x'.repeat(TOPIC_CAP + 1) })

    expect(result.success).toBe(false)
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('refuses a draft note over the 50k content cap without calling the model', async () => {
    const result = await generateCards({
      draftNote: { title: 'Note', content: 'x'.repeat(TEXT_CAP + 1) },
    })

    expect(result.success).toBe(false)
    expect(generateObjectMock).not.toHaveBeenCalled()
  })
})
