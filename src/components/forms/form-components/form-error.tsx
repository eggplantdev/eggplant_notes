import { cn } from '@/lib/utils'

type FormErrorPropsT = {
  message?: string
  // Extra classes for callers that need to position the error (e.g. absolute, so it doesn't shift siblings).
  className?: string
}

// Single source for error styling, shared by field-level (FormInput) and form-level (auth pages) errors.
export function FormError({ message, className }: FormErrorPropsT) {
  if (!message) return null
  return <p className={cn('text-destructive text-sm', className)}>{message}</p>
}
