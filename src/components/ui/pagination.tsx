import * as React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'

// PaginationLink renders a NON-anchor <span> on purpose: UrlPagination wraps each in a Next <Link>,
// and an <a> inside an <a> is invalid HTML.

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full flex-wrap justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkPropsT = {
  isActive?: boolean
  isDisabled?: boolean
  children?: React.ReactNode
  className?: string
  'aria-label'?: string
  'aria-hidden'?: boolean
}

function PaginationLink({ className, isActive, isDisabled, ...props }: PaginationLinkPropsT) {
  return (
    <span
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={isDisabled}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        'inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-xs font-medium transition-all duration-200 select-none',
        isActive && 'border-foreground text-foreground border',
        !isActive && !isDisabled && 'border-border text-foreground hover:bg-accent border',
        isDisabled && 'text-muted-foreground pointer-events-none cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}

type PaginationNavPropsT = PaginationLinkPropsT & { label?: string }

function PaginationPrevious({
  className,
  label = 'Go to previous page',
  ...props
}: PaginationNavPropsT) {
  return (
    <PaginationLink aria-label={label} className={cn('w-auto gap-1 px-3', className)} {...props}>
      <ChevronLeft className="size-4" />
    </PaginationLink>
  )
}

function PaginationNext({ className, label = 'Go to next page', ...props }: PaginationNavPropsT) {
  return (
    <PaginationLink aria-label={label} className={cn('w-auto gap-1 px-3', className)} {...props}>
      <ChevronRight className="size-4" />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'> & { srLabel?: string }) {
  const { srLabel = 'More pages', ...rest } = props
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        'text-muted-foreground inline-flex size-8 items-center justify-center',
        className,
      )}
      {...rest}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">{srLabel}</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
