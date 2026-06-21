import { Spinner } from '@/components/ui/spinner'

// Route-segment Suspense fallback for every protected page. These pages are dynamic (they await
// searchParams/params + DB reads), so Next skips prefetching them — without this file the router
// blocked on the full server render before swapping, so a nav click showed no feedback at all. With
// it, the fallback is (partially) prefetched and shown instantly on navigation, then swapped for the
// real page. Renders inside the layout's <main>, so it inherits the container width + top offset.
export default function ProtectedLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}
