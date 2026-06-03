// Streaming fallback for the review session while the due queue is fetched server-side.
export default function ReviewLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <div className="bg-muted h-8 w-32 animate-pulse rounded-md" />
      <div className="bg-muted h-40 w-full animate-pulse rounded-lg" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 animate-pulse rounded-lg" />
      </div>
    </main>
  )
}
