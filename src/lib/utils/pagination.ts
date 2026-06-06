// Fixed list page size across the app's paginated list reads (notes / memory cards / subjects).
// No per-page selector for MVP.
export const DEFAULT_LIMIT = 100

// Shape the PaginationFooter / UrlPagination render from. `totalDocs` is the full match count
// (the query's `total`), not the page length.
export type PaginationMetaT = {
  currentPage: number
  totalPages: number
  totalDocs: number
  limit: number
}

type SearchParamsT = Record<string, string | string[] | undefined>

// Parse the page number off the URL search params, clamped to >= 1 (a non-numeric / zero / negative
// `?page=` falls back to 1). The page size is fixed (no selector for MVP), so a `?limit=` in the URL
// is intentionally ignored — every request uses DEFAULT_LIMIT. Returned together so callers thread
// one object into both the query and buildPaginationMeta.
export function parsePagination(searchParams: SearchParamsT): { page: number; limit: number } {
  const raw = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1
  const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
  return { page, limit: DEFAULT_LIMIT }
}

// Build the footer's view-model from a query's `{ total }` + the page/limit it ran with. totalPages
// is at least 1 so an empty result still renders coherently (the footer hides itself at <= 1 page).
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMetaT {
  return {
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    totalDocs: total,
    limit,
  }
}
