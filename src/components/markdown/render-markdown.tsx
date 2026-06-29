import { MarkdownAsync } from 'react-markdown'

import { REHYPE_PLUGINS, REMARK_PLUGINS } from './markdown-plugins'

type RenderMarkdownPropsT = { content: string }

// Server detail view. Uses `MarkdownAsync` because Shiki is async (sync `Markdown` can't await
// @shikijs/rehype). No rehype-raw, so raw HTML stays escaped and note bodies can't inject executable markup.
export async function RenderMarkdown({ content }: RenderMarkdownPropsT) {
  return (
    <div className="prose dark:prose-invert max-w-none min-w-0 break-words [&_pre]:overflow-x-auto">
      <MarkdownAsync remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
        {content}
      </MarkdownAsync>
    </div>
  )
}
