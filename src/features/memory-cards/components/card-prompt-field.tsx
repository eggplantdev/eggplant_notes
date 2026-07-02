'use client'

import { useId } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type CardPromptFieldPropsT = {
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
}

// The Question field for a memory card: label + an autosizing Textarea (not an Input, so long AI
// questions show in full instead of clipping — rows=1 + min-h-0 hugs a one-liner) + inline error.
// gap-2 keeps the label close to its field, matching CardExampleField and FormTextarea. Plain
// value/onChange so it drops into a form field or a controlled candidate row alike.
export function CardPromptField({
  value,
  onChange,
  error,
  label = 'Question',
}: CardPromptFieldPropsT) {
  const id = useId()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className="min-h-0"
      />
      <FormError message={error} />
    </div>
  )
}
