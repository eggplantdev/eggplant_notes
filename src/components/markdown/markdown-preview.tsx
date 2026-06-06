'use client'

import { useDeferredValue, useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MarkdownPreviewPropsT = { content: string }

// Plain react-markdown, no Shiki, to keep highlighting bytes off the client (the detail view is the highlighted render).
// useDeferredValue + useMemo defer the non-trivial remark parse to a typing pause so the editor stays responsive.
export function MarkdownPreview({ content }: MarkdownPreviewPropsT) {
  const deferred = useDeferredValue(content)
  return useMemo(
    () => (
      <Markdown remarkPlugins={[remarkGfm]}>{deferred || '*Nothing to preview yet.*'}</Markdown>
    ),
    [deferred],
  )
}
