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

  it('documents the three API resource paths', () => {
    expect(CLC_SKILL_TEMPLATE).toContain('/api/subjects')
    expect(CLC_SKILL_TEMPLATE).toContain('/api/notes')
    expect(CLC_SKILL_TEMPLATE).toContain('/api/memory-cards')
  })

  it('documents the Phase-1 CRUD endpoints + their methods', () => {
    // Per-id read-back + the create/update/delete surface added in clc-api-crud-endpoints Phase 1.
    expect(CLC_SKILL_TEMPLATE).toContain('GET /api/notes/:id')
    expect(CLC_SKILL_TEMPLATE).toContain('GET /api/memory-cards')
    expect(CLC_SKILL_TEMPLATE).toContain('POST /api/subjects')
    expect(CLC_SKILL_TEMPLATE).toContain('PATCH /api/subjects/:id')
    expect(CLC_SKILL_TEMPLATE).toContain('DELETE /api/notes/:id')
    expect(CLC_SKILL_TEMPLATE).toContain('DELETE /api/memory-cards/:id')
    expect(CLC_SKILL_TEMPLATE).toContain('DELETE /api/subjects/:id')
  })

  it('warns about the delete cascade / unfile semantics', () => {
    expect(CLC_SKILL_TEMPLATE).toContain('Deleting a note also deletes all of its cards')
    expect(CLC_SKILL_TEMPLATE).toContain('Deleting a subject does NOT delete its notes or cards')
  })

  it('injects a given origin in place of every placeholder', () => {
    const origin = 'https://clc.example.com'
    const filled = CLC_SKILL_TEMPLATE.replaceAll(CLC_BASE_URL_PLACEHOLDER, origin)

    expect(filled).not.toContain(CLC_BASE_URL_PLACEHOLDER)
    expect(filled).toContain(`BASE=${origin}`)
  })
})
