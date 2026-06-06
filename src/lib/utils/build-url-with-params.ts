// Merges param overrides into the current query string. An empty-string value DELETES its key —
// this is how callers reset `page` (pass `{ page: '' }`) or clear `q`.
export function buildUrlWithParams(
  baseUrl: string,
  currentParams: string,
  overrides: Record<string, string>,
): string {
  const params = new URLSearchParams(currentParams)

  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value)
    else params.delete(key)
  }

  const qs = params.toString()
  return `${baseUrl}${qs ? `?${qs}` : ''}`
}
