'use client'

import { useDeferredValue } from 'react'
import Markdown, { MarkdownHooks } from 'react-markdown'

import { REHYPE_PLUGINS, REMARK_PLUGINS } from './markdown-plugins'

type MarkdownPreviewPropsT = { content: string }

// Live preview. `MarkdownHooks` runs the same async Shiki pipeline as the server detail view, so the
// preview and the saved view highlight identically. The `fallback` renders the SAME content with plain
// (sync) `Markdown` — no Shiki — so on first paint the content is visible immediately and only the code
// fences upgrade from plain to highlighted; nothing flashes empty. useDeferredValue keeps typing snappy.
export function MarkdownPreview({ content }: MarkdownPreviewPropsT) {
  const deferred = useDeferredValue(content)
  const source = deferred || '*Nothing to preview yet.*'
  return (
    <MarkdownHooks
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      fallback={<Markdown remarkPlugins={REMARK_PLUGINS}>{source}</Markdown>}
    >
      {source}
    </MarkdownHooks>
  )
}
