'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { getWindowedPages } from '@/components/ui/get-windowed-pages'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'
import { cn } from '@/lib/utils'

type UrlPaginationPropsT = {
  currentPage: number
  totalPages: number
  baseUrl: string
  className?: string
}

// hrefs are built with buildUrlWithParams so `q`/`subjects` ride along and `page` drops on page 1.
// Reads the live query string so links reflect current filters. Renders nothing for a single page.
export function UrlPagination({
  currentPage,
  totalPages,
  baseUrl,
  className,
}: UrlPaginationPropsT) {
  const searchParams = useSearchParams()
  if (totalPages <= 1) return null

  const pageUrl = (page: number) =>
    buildUrlWithParams(baseUrl, searchParams.toString(), { page: page > 1 ? String(page) : '' })

  const pages = getWindowedPages(currentPage, totalPages)
  const isFirst = currentPage <= 1
  const isLast = currentPage >= totalPages
  const showFirst = !pages.includes(1)
  const showLast = !pages.includes(totalPages)

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <Link
            className={cn(isFirst && 'pointer-events-none')}
            href={pageUrl(currentPage - 1)}
            scroll={false}
            aria-disabled={isFirst}
            tabIndex={isFirst ? -1 : undefined}
          >
            <PaginationPrevious isDisabled={isFirst} />
          </Link>
        </PaginationItem>

        {showFirst && (
          <>
            <PaginationItem>
              <Link href={pageUrl(1)} scroll={false}>
                <PaginationLink aria-label="Go to first page">1</PaginationLink>
              </Link>
            </PaginationItem>
            {!pages.includes(2) && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
          </>
        )}

        {pages.map((page) => (
          <PaginationItem key={page}>
            <Link
              className={cn(page === currentPage && 'pointer-events-none')}
              href={pageUrl(page)}
              scroll={false}
            >
              <PaginationLink isActive={page === currentPage} aria-label={`Go to page ${page}`}>
                {page}
              </PaginationLink>
            </Link>
          </PaginationItem>
        ))}

        {showLast && (
          <>
            {!pages.includes(totalPages - 1) && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            <PaginationItem>
              <Link href={pageUrl(totalPages)} scroll={false}>
                <PaginationLink aria-label="Go to last page">{totalPages}</PaginationLink>
              </Link>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <Link
            className={cn(isLast && 'pointer-events-none')}
            href={pageUrl(currentPage + 1)}
            scroll={false}
            aria-disabled={isLast}
            tabIndex={isLast ? -1 : undefined}
          >
            <PaginationNext isDisabled={isLast} />
          </Link>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
