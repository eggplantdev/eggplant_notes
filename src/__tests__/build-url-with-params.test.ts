import { describe, expect, it } from 'vitest'

import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

// Guards the URL builder the pagination links + both filter commits (search, subjects) share.
describe('buildUrlWithParams', () => {
  it('merges an override into the existing query string', () => {
    expect(buildUrlWithParams('/notes', 'q=foo', { page: '2' })).toBe('/notes?q=foo&page=2')
  })

  it('an empty-string value deletes the key (how page 1 drops ?page)', () => {
    expect(buildUrlWithParams('/notes', 'q=foo&page=3', { page: '' })).toBe('/notes?q=foo')
  })

  it('resets page while changing the query — the cross-component page-reset invariant', () => {
    // { q, page: '' } sets q and deletes page in one call.
    expect(buildUrlWithParams('/notes', 'page=5&subjects=a', { q: 'bar', page: '' })).toBe(
      '/notes?subjects=a&q=bar',
    )
  })

  it('returns a bare path when no params remain', () => {
    expect(buildUrlWithParams('/notes', '', {})).toBe('/notes')
    expect(buildUrlWithParams('/notes', '', { page: '' })).toBe('/notes')
  })
})
