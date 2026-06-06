import { UrlPagination } from '@/components/ui/url-pagination'
import { cn } from '@/lib/utils'
import type { PaginationMetaT } from '@/lib/utils/pagination'

type PaginationFooterPropsT = {
  paginationMeta: PaginationMetaT
  baseUrl: string
  className?: string
}

// List footer: a "Showing X–Y of Z" range summary + the windowed page nav (UrlPagination). Renders
// nothing for a single page — the PageShell subtitle already carries the total count, so a footer
// would be redundant noise when everything fits on one page. The page-size <Select> from the
// reference is dropped (fixed page size = DEFAULT_LIMIT, no selector for MVP).
export function PaginationFooter({ paginationMeta, baseUrl, className }: PaginationFooterPropsT) {
  const { currentPage, totalPages, totalDocs, limit } = paginationMeta
  if (totalPages <= 1) return null

  // Clamp `from` to totalDocs so an out-of-range deep page (?page=99) reads "Showing 30–30 of 30"
  // rather than "Showing 2353–30 of 30" — the accepted no-redirect out-of-range case (parsePagination
  // clamps only the lower bound, so an upper overflow reaches here).
  const from = totalDocs === 0 ? 0 : Math.min((currentPage - 1) * limit + 1, totalDocs)
  const to = Math.min(currentPage * limit, totalDocs)

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
      <p className="text-muted-foreground text-sm">
        Showing {from}–{to} of {totalDocs}
      </p>
      <UrlPagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  )
}
