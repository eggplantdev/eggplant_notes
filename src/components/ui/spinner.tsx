import { cn } from '@/lib/utils'

// Green→cyan gradient ring (the `gradient-spinner` utility) instead of a flat Lucide icon, so the
// loading state reads in the app's brand hues. Default size-4 matches inline icon spinners.
function Spinner({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('gradient-spinner size-4 shrink-0 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
