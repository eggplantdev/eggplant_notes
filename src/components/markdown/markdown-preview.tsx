'use client'

import { useDeferredValue, useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownPreviewPropsT = { content: string }

// Client-side live preview for the note editor. Plain react-markdown (no Shiki) — the
// authoritative highlighted render is the saved detail view, kept server-only to keep
// highlighting bytes off the client. `useDeferredValue` + `useMemo` mean the (non-trivial)
// remark parse runs at low priority on a typing pause and is skipped entirely between
// keystrokes that don't change the deferred value, so the editor stays responsive.
export function MarkdownPreview({ content }: MarkdownPreviewPropsT) {
  const deferred = useDeferredValue(content)
  return useMemo(
    () => (
      <Markdown remarkPlugins={[remarkGfm]}>{deferred || '*Nothing to preview yet.*'}</Markdown>
    ),
    [deferred],
  )
}
