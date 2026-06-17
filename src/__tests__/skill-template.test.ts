import { describe, expect, it } from 'vitest'

import { BASE_URL_PLACEHOLDER, SKILL_TEMPLATE } from '@/features/api-tokens/skill-template'

// The served TS constant is a generated mirror of the change-folder .md. These pins fail CI if the
// mirror drifts from the documented contract — the placeholder vanishes, an endpoint is dropped, or
// the route's injection no longer lands.
describe('SKILL_TEMPLATE', () => {
  it('still carries the injection placeholder', () => {
    expect(BASE_URL_PLACEHOLDER).toBe('{{BASE_URL}}')
    expect(SKILL_TEMPLATE).toContain(BASE_URL_PLACEHOLDER)
  })

  it('documents the three API resource paths', () => {
    expect(SKILL_TEMPLATE).toContain('/api/subjects')
    expect(SKILL_TEMPLATE).toContain('/api/notes')
    expect(SKILL_TEMPLATE).toContain('/api/memory-cards')
  })

  it('documents the Phase-1 CRUD endpoints + their methods', () => {
    // Per-id read-back + the create/update/delete surface added in clc-api-crud-endpoints Phase 1.
    expect(SKILL_TEMPLATE).toContain('GET /api/notes/:id')
    expect(SKILL_TEMPLATE).toContain('GET /api/memory-cards')
    expect(SKILL_TEMPLATE).toContain('POST /api/subjects')
    expect(SKILL_TEMPLATE).toContain('PATCH /api/subjects/:id')
    expect(SKILL_TEMPLATE).toContain('DELETE /api/notes/:id')
    expect(SKILL_TEMPLATE).toContain('DELETE /api/memory-cards/:id')
    expect(SKILL_TEMPLATE).toContain('DELETE /api/subjects/:id')
  })

  it('documents the Phase-2 PATCH endpoints + the linked/unlinked card invariant', () => {
    expect(SKILL_TEMPLATE).toContain('PATCH /api/notes/:id')
    expect(SKILL_TEMPLATE).toContain('PATCH /api/memory-cards/:id')
    // The move-all default + the explicit per-card override must both be taught.
    expect(SKILL_TEMPLATE).toContain('card_actions')
    expect(SKILL_TEMPLATE).toContain('Linked vs standalone cards')
  })

  it('warns about the delete cascade / unfile semantics', () => {
    expect(SKILL_TEMPLATE).toContain('Deleting a note also deletes all of its cards')
    expect(SKILL_TEMPLATE).toContain('Deleting a subject does NOT delete its notes or cards')
  })

  it('the frontmatter description advertises the write surface, not just read+add (discovery)', () => {
    // Guards the gap where the Endpoints section grew CRUD but the description — what an agent matches
    // on to PICK the skill — still only mentioned read/add, so edit/delete tasks never triggered it.
    const description = SKILL_TEMPLATE.split('---')[1] ?? ''
    expect(description).toMatch(/update/i)
    expect(description).toMatch(/delete/i)
  })

  it('injects a given origin in place of every placeholder', () => {
    const origin = 'https://clc.example.com'
    const filled = SKILL_TEMPLATE.replaceAll(BASE_URL_PLACEHOLDER, origin)

    expect(filled).not.toContain(BASE_URL_PLACEHOLDER)
    expect(filled).toContain(`BASE=${origin}`)
  })
})
