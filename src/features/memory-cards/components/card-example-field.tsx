'use client'

import { EditorWithPreview } from '@/components/markdown/editor-with-preview'
import { Label } from '@/components/ui/label'

export function CardExampleField({
  value,
  onChange,
  label = 'Example (optional)',
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <EditorWithPreview value={value} onChange={onChange} />
    </div>
  )
}
