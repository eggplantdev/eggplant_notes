// Fixed page size for all list reads; no per-page selector for MVP.
export const DEFAULT_LIMIT = 100

// Resolves a list query's `?page`/`?limit` opts to the `{ offset, limit }` a PostgREST `.range()`
// needs (`range(offset, offset + limit - 1)`). Single-sources the `?? 1` / `?? DEFAULT_LIMIT`
// defaults every paginated query repeated.
export function pageRange(opts?: { page?: number; limit?: number }): {
  offset: number
  limit: number
} {
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? DEFAULT_LIMIT
  return { offset: (page - 1) * limit, limit }
}

export type PaginationMetaT = {
  currentPage: number
  totalPages: number
  totalDocs: number
  limit: number
}

type SearchParamsT = Record<string, string | string[] | undefined>

// Clamps `?page=` to >= 1 (non-numeric/zero/negative falls back to 1). A `?limit=` in the URL is
// intentionally ignored — page size is fixed at DEFAULT_LIMIT.
export function parsePagination(searchParams: SearchParamsT): { page: number; limit: number } {
  const raw = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1
  const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
  return { page, limit: DEFAULT_LIMIT }
}

// totalPages is floored at 1 so an empty result still renders coherently.
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMetaT {
  return {
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    totalDocs: total,
    limit,
  }
}
