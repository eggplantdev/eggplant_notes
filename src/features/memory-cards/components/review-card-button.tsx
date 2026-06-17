'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

// Per-card Review affordance for the listing. Instead of navigating to a detail route, it selects the
// card for the in-place review panel via `?review=<id>` (filters preserved). `scroll: false` keeps
// Next from hard-jumping to the top — once the swapped card mounts, ReviewCardTransition smooth-scrolls
// it to the vertical center (scrolling here would fire before the new card has loaded).
export function ReviewCardButton({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onReview = () => {
    const params = new URLSearchParams(searchParams)
    params.set('review', id)
    router.replace(`/memory-cards?${params}`, { scroll: false })
  }

  return (
    <Button variant="outline" size="sm" onClick={onReview}>
      Review
    </Button>
  )
}
