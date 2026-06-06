// Fixed list page size across the app's paginated list reads (notes / memory cards / subjects).
// Chosen to fill the 1/2/3-column responsive card grid cleanly; no per-page selector for MVP.
// Phase 2 extends this module with parsePagination / buildPaginationMeta built on this constant.
export const DEFAULT_LIMIT = 24
