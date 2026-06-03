'use client'

import { useSearchParams } from 'next/navigation'

// Confirms account teardown after the post-delete redirect to /sign-in?deleted=1.
// Reads the query via useSearchParams (the sign-in page is a client component, so
// the server `searchParams` prop is unavailable) — MUST be rendered inside a
// <Suspense> boundary or it de-opts the route's static rendering and fails build.
export function DeletedNotice() {
  const isDeleted = useSearchParams().get('deleted') === '1'
  if (!isDeleted) return null

  return (
    <p role="status" className="text-muted-foreground mb-4 text-sm">
      Your account and all data were deleted.
    </p>
  )
}
