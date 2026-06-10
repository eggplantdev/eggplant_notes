'use client'

import dynamic from 'next/dynamic'

import { Spinner } from '@/components/ui/spinner'

// CodeMirror touches window/document so it must load client-only; ssr:false is legal only in a 'use client'
// component (Next 16). Dynamic import keeps the whole CodeMirror dep graph off the server bundle and ships it only on editor routes.
const CodeMirrorEditor = dynamic(() => import('@/components/markdown/code-mirror-editor'), {
  ssr: false,
  // Brand gradient Spinner, not a skeleton (house convention — AGENTS.md). min-h-80 reserves the
  // editor's height so the swap-in causes no layout shift.
  loading: () => (
    <div className="flex min-h-80 items-center justify-center">
      <Spinner className="size-8 [--spinner-w:4px]" />
    </div>
  ),
})

type MarkdownEditorPropsT = {
  value: string
  onChange: (value: string) => void
}

// Not registered into the shared form hook — it's a 3rd-party controlled input; value/onChange come from the field.
export function MarkdownEditor({ value, onChange }: MarkdownEditorPropsT) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <CodeMirrorEditor value={value} onChange={onChange} />
    </div>
  )
}
