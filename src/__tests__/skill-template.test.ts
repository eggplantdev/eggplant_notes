import { describe, expect, it } from 'vitest'

import { CLC_BASE_URL_PLACEHOLDER, CLC_SKILL_TEMPLATE } from '@/features/api-tokens/skill-template'

// The served TS constant is a generated mirror of the change-folder .md. These pins fail CI if the
// mirror drifts from the documented contract — the placeholder vanishes, an endpoint is dropped, or
// the route's injection no longer lands.
describe('CLC_SKILL_TEMPLATE', () => {
  it('still carries the injection placeholder', () => {
    expect(CLC_BASE_URL_PLACEHOLDER).toBe('{{CLC_BASE_URL}}')
    expect(CLC_SKILL_TEMPLATE).toContain(CLC_BASE_URL_PLACEHOLDER)
  })

  it('documents the three API endpoints', () => {
    expect(CLC_SKILL_TEMPLATE).toContain('/api/subjects')
    expect(CLC_SKILL_TEMPLATE).toContain('/api/notes')
    expect(CLC_SKILL_TEMPLATE).toContain('/api/memory-cards')
  })

  it('injects a given origin in place of every placeholder', () => {
    const origin = 'https://clc.example.com'
    const filled = CLC_SKILL_TEMPLATE.replaceAll(CLC_BASE_URL_PLACEHOLDER, origin)

    expect(filled).not.toContain(CLC_BASE_URL_PLACEHOLDER)
    expect(filled).toContain(`BASE=${origin}`)
  })
})
